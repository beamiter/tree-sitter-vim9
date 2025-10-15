#include "stdio.h"
#include "stdlib.h"
#include "tree_sitter/parser.h"
#include <string.h>
#include <wctype.h>
#include <assert.h>
#include <stdbool.h>

#define IS_SPACE_TABS(char) ((char) == ' ' || (char) == '\t')
#define HEREDOC_MARKER_LEN 32

typedef struct {
  char separator;
  bool ignore_comments;
  uint8_t marker_len;
  char heredoc_marker[HEREDOC_MARKER_LEN];
} Scanner;

typedef struct {
  char * mandat;
  char * opt;
  bool ignore_comments_after;
} keyword;

#include "keywords.h"

enum TokenType {
  NO,
  INV,
  CMD_SEPARATOR,
  LINE_CONTINUATION,
  SCRIPT_HEREDOC_MARKER,
  LET_HEREDOC_MARKER,
  HEREDOC_END,
  SEP_FIRST,
  SEP,
  SCOPE_DICT,
  SCOPE,
  STRING,
  COMMENT,
  LINE_CONTINUATION_COMMENT,
  BANG_FILTER,
  KEYWORDS_BASE
};

void *tree_sitter_vim_external_scanner_create() {
  Scanner *s = (Scanner *)malloc(sizeof(Scanner));
  s->separator = '\0';
  s->marker_len = 0;
  s->ignore_comments = false;
  memset(s->heredoc_marker, '\0', HEREDOC_MARKER_LEN);
  return (void *)s;
}

void tree_sitter_vim_external_scanner_destroy(void *payload) {
  Scanner *s = (Scanner *)payload;
  free(s);
}

#define SC_IGNORE_COMMENTS 0
#define SC_PAIRED_SEP 1
#define SC_MARK_LEN 2
#define SC_MARK 3

unsigned int tree_sitter_vim_external_scanner_serialize(void *payload,
                                                        char *buffer) {
  Scanner *s = (Scanner *)payload;
  buffer[SC_PAIRED_SEP] = s->separator;
  buffer[SC_IGNORE_COMMENTS] = s->ignore_comments;
  buffer[SC_MARK_LEN] = s->marker_len;

  strncpy(buffer + SC_MARK, s->heredoc_marker, s->marker_len);
  return s->marker_len + SC_MARK;
}

void tree_sitter_vim_external_scanner_deserialize(void *payload,
                                                  const char *buffer,
                                                  unsigned length) {
  if (length == 0) {
    return;
  }
  Scanner *s = (Scanner *)payload;
  s->ignore_comments = buffer[SC_IGNORE_COMMENTS];
  s->separator = buffer[SC_PAIRED_SEP];
  s->marker_len = buffer[SC_MARK_LEN];

  assert(s->marker_len + SC_MARK == length);
  assert(s->marker_len < HEREDOC_MARKER_LEN);

  if (s->marker_len > 0) {
    strncpy(s->heredoc_marker, buffer + SC_MARK, s->marker_len);
  }
}

static void advance(TSLexer *lexer, bool skip) { lexer->advance(lexer, skip); }

static void skip_space_tabs(TSLexer *lexer) {
  while (IS_SPACE_TABS(lexer->lookahead)) {
    advance(lexer, true);
  }
}

static bool check_prefix(TSLexer *lexer, char *prefix, unsigned int prefix_len,
                         enum TokenType token) {
  for (unsigned int i = 0; i < prefix_len; i++) {
    if (lexer->lookahead == prefix[i]) {
      advance(lexer, false);
    } else {
      return false;
    }
  }
  lexer->result_symbol = token;
  return true;
}

static bool try_lex_heredoc_marker(Scanner *scanner, TSLexer *lexer)
{
  char marker[UINT8_MAX] = { '\0' };
  uint16_t marker_len = 0;

  if (iswlower(lexer->lookahead)) {
    return false;
  }

  while ((!IS_SPACE_TABS(lexer->lookahead)) && lexer->lookahead && lexer->lookahead != '\n' && marker_len < HEREDOC_MARKER_LEN) {
    marker[marker_len] = lexer->lookahead;
    marker_len++;
    advance(lexer, false);
  }

  if (marker_len == HEREDOC_MARKER_LEN || marker_len == 0) {
    return false;
  }

  strncpy(scanner->heredoc_marker, marker, marker_len);
  scanner->marker_len = marker_len;
  memset(scanner->heredoc_marker + marker_len, '\0', HEREDOC_MARKER_LEN - marker_len);

  return true;
}

static bool is_valid_string_delim(char c) {
  return c == '\'' || c == '"';
}

static bool lex_literal_string(TSLexer *lexer) {
  while (true) {
    if(lexer->lookahead == '\'') {
      advance(lexer, false);
      if (lexer->lookahead == '\'') {
        advance(lexer, false);
      } else {
        lexer->result_symbol = STRING;
        lexer->mark_end(lexer);
        return true;
      }
    } else if (lexer->lookahead == '\n') {
      lexer->mark_end(lexer);
      advance(lexer, true);
      skip_space_tabs(lexer);
      if (lexer->lookahead != '\\') {
        return false;
      }
    } else if (lexer->lookahead == '\0') {
      return false;
    } else {
      advance(lexer, false);
    }
  }
}

static bool lex_escapable_string(TSLexer *lexer) {
  while (true) {
    if (lexer->lookahead == '\\') {
      advance(lexer, false);
      advance(lexer, false);
    } else if (lexer->lookahead == '"') {
      advance(lexer, false);
      lexer->mark_end(lexer);
      lexer->result_symbol = STRING;
      return true;
    } else if (lexer->lookahead == '\n') {
      lexer->mark_end(lexer);
      advance(lexer, false);
      skip_space_tabs(lexer);
      if (lexer->lookahead != '\\') {
        lexer->mark_end(lexer);
        lexer->result_symbol = COMMENT;
        return true;
      }
    } else if (lexer->lookahead == '\0') {
      return false;
    } else {
      advance(lexer, false);
    }
  }
}

static bool lex_string(TSLexer *lexer) {
  char string_delim;

  if (!is_valid_string_delim(lexer->lookahead)) {
    return false;
  }

  string_delim = lexer->lookahead;
  advance(lexer, false);

  switch (string_delim) {
    case '"':
      return lex_escapable_string(lexer);
    case '\'':
      return lex_literal_string(lexer);
    default:
      assert(0);
  }
}

static bool try_lex_keyword(char *possible, keyword keyword) {
  if (strlen(possible) > strlen(keyword.mandat) + strlen(keyword.opt)) {
    return false;
  }

  size_t i;
  for (i = 0; keyword.mandat[i] && possible[i]; i++) {
    if (possible[i] != keyword.mandat[i]) {
      return false;
    }
  }

  if (keyword.mandat[i] && !possible[i])
    return false;

  size_t mandat_len = i;
  for (size_t i = 0; keyword.opt[i] && possible[mandat_len + i]; i++) {
    if (possible[mandat_len + i] != keyword.opt[i]) {
      return false;
    }
  }

  return true;
}

static bool scope_correct(TSLexer *lexer) {
  const char *SCOPES = "lbstvwg<";
  for (size_t i = 0; SCOPES[i]; i++) {
    if (lexer->lookahead == SCOPES[i]) {
      return true;
    }
  }
  return false;
}

static bool lex_scope(TSLexer *lexer) {
  if (!scope_correct(lexer)) {
    return false;
  }

  if (lexer->lookahead == '<') {
    advance(lexer, false);
    const char sid[5] = "SID>";
    for (size_t i = 0; sid[i] && lexer->lookahead; i++) {
      if (lexer->lookahead != sid[i]) {
        return false;
      }
      advance(lexer, false);
    }
    lexer->result_symbol = SCOPE;
    return true;
  } else {
    advance(lexer, false);

    if (lexer->lookahead != ':') {
      return false;
    }
    advance(lexer, false);

    if (iswalnum(lexer->lookahead) || lexer->lookahead == '{' || lexer->lookahead == '_') {
      lexer->result_symbol = SCOPE;
    } else {
      lexer->result_symbol = SCOPE_DICT;
    }

    return true;
  }
}

bool tree_sitter_vim_external_scanner_scan(void *payload, TSLexer *lexer,
                                           const bool *valid_symbols) {
  Scanner *s = (Scanner *)payload;
  assert(valid_symbols[LINE_CONTINUATION]);

  skip_space_tabs(lexer);
  if (!lexer->lookahead) {
    return false;
  }

  if (valid_symbols[SEP_FIRST] && iswpunct(lexer->lookahead)) {
    s->separator = lexer->lookahead;
    advance(lexer, false);
    s->ignore_comments = true;
    lexer->result_symbol = SEP_FIRST;
    return true;
  } else if (valid_symbols[SEP] && s->separator == lexer->lookahead) {
    advance(lexer, false);
    s->ignore_comments = false;
    lexer->result_symbol = SEP;
    return true;
  }

  if (valid_symbols[BANG_FILTER] && lexer->lookahead == '!') {
    advance(lexer, false);
    s->ignore_comments = true;
    lexer->result_symbol = BANG_FILTER;
    return true;
  }

  if (valid_symbols[NO] && lexer->lookahead == 'n') {
    return check_prefix(lexer, "no", 2, NO);
  } else if (valid_symbols[INV] && lexer->lookahead == 'i') {
    return check_prefix(lexer, "inv", 3, INV);
  }

  if (lexer->lookahead == '\n') {
    advance(lexer, false);
    lexer->mark_end(lexer);
    skip_space_tabs(lexer);

    if (lexer->lookahead == '\\') {
      advance(lexer, false);

      if (lexer->lookahead == '/'
          || lexer->lookahead == '?'
          || lexer->lookahead == '&') {
        if (valid_symbols[CMD_SEPARATOR]) {
          lexer->result_symbol = CMD_SEPARATOR;
          s->ignore_comments = false;
          return true;
        } else {
          return false;
        }
      }

      lexer->mark_end(lexer);
      lexer->result_symbol = LINE_CONTINUATION;
      return true;
    } else if (s->marker_len == 0 && check_prefix(lexer, "\"\\ ", 3, LINE_CONTINUATION_COMMENT)) {
      while (lexer->lookahead != '\0' && lexer->lookahead != '\n') {
        advance(lexer, false);
      }
      lexer->mark_end(lexer);
      return true;
    } else if (valid_symbols[CMD_SEPARATOR]) {
      lexer->result_symbol = CMD_SEPARATOR;
      s->ignore_comments = false;
      return true;
    } else {
      return false;
    }
  }

  if (valid_symbols[CMD_SEPARATOR] && lexer->lookahead == '|') {
    advance(lexer, false);
    if (lexer->lookahead == '|') {
      return false;
    }
    lexer->result_symbol = CMD_SEPARATOR;
    return true;
  }

  // 作用域优先
  if (scope_correct(lexer) && (valid_symbols[SCOPE_DICT] || valid_symbols[SCOPE])) {
    if (lex_scope(lexer)) {
      return true;
    } else {
      return false;
    }
  }

  if (valid_symbols[SCRIPT_HEREDOC_MARKER]) {
    lexer->result_symbol = SCRIPT_HEREDOC_MARKER;
    return try_lex_heredoc_marker(s, lexer);
  }
  if (valid_symbols[LET_HEREDOC_MARKER]) {
    lexer->result_symbol = LET_HEREDOC_MARKER;
    return try_lex_heredoc_marker(s, lexer);
  }
  if (valid_symbols[HEREDOC_END]) {
    uint8_t marker_len = s->marker_len != 0 ? s->marker_len : 1;
    char *marker = s->marker_len != 0 ? s->heredoc_marker : ".";

    if (!check_prefix(lexer, marker, marker_len, HEREDOC_END)) {
      return false;
    }

    if (lexer->lookahead != '\0' && lexer->lookahead != '\n') {
      return false;
    }

    s->marker_len = 0;
    memset(s->heredoc_marker, '\0', HEREDOC_MARKER_LEN);
    return true;
  }

  if (valid_symbols[COMMENT] && !valid_symbols[STRING]
      && lexer->lookahead == '"' && !s->ignore_comments) {
    do {
      advance(lexer, false);
    } while (lexer->lookahead != '\n' && lexer->lookahead != '\0');

    lexer->result_symbol = COMMENT;
    return true;
  } else if (valid_symbols[STRING]) {
    return lex_string(lexer);
  }

  // 关键字（带缩写），避免把单字母后跟 ":" 的作用域前缀误判为关键字
  if (iswlower(lexer->lookahead)) {
#define KEYWORD_SIZE 30
    char keyword[KEYWORD_SIZE + 1] = { lexer->lookahead, 0 };

    // 如果下一个字符是 ':'，把它视为作用域前缀而不是关键字
    // 为了不破坏后续解析，这里直接消费 ':' 并返回 SCOPE
    if (lexer->lookahead && (lexer->lookahead == 'g' || lexer->lookahead == 'b' ||
                             lexer->lookahead == 'l' || lexer->lookahead == 't' ||
                             lexer->lookahead == 'w' || lexer->lookahead == 's' ||
                             lexer->lookahead == 'v')) {
      // 先不消费字母，看看下一个是不是 ':'
      // 我们必须消费当前字母才能看到下一个字符
      advance(lexer, false);
      if (lexer->lookahead == ':') {
        advance(lexer, false);
        lexer->result_symbol = SCOPE;
        return true;
      }
      // 否则继续关键字路径，keyword[0] 已是首字母
    } else {
      advance(lexer, false);
    }

    size_t i = 1;
    for (; i < KEYWORD_SIZE && iswalpha(lexer->lookahead); i++) {
      keyword[i] = lexer->lookahead;
      advance(lexer, false);
    }

    if (i == KEYWORD_SIZE) {
      return false;
    }

    keyword[i] = '\0';

    for (kwid t = FUNCTION; t < UNKNOWN_COMMAND; t++) {
      if (valid_symbols[t + KEYWORDS_BASE] && try_lex_keyword(keyword, keywords[t])) {
        lexer->result_symbol = t + KEYWORDS_BASE;
        s->ignore_comments = keywords[t].ignore_comments_after;
        return true;
      }
    }

    if (valid_symbols[UNKNOWN_COMMAND + KEYWORDS_BASE]) {
      lexer->result_symbol = UNKNOWN_COMMAND + KEYWORDS_BASE;
      return true;
    }
#undef KEYWORD_SIZE
  }

  return false;
}
