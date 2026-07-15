vim9script

import './lib.vim' as Lib

export type NameList = list<string>
const DEFAULT_LIMIT: number = 10
var cache: dict<any> = {}

export def Sum(values: list<number>): number
  var total = 0
  for value in values
    if value > 0
      total += value
    elseif value == 0
      continue
    else
      throw 'negative value'
    endif
  endfor
  return total
enddef

interface Named
  def Name(): string
endinterface

class Item implements Named
  public var label: string

  def new(this.label)
  enddef

  def Name(): string
    return this.label
  enddef
endclass

enum Color
  Red,
  Green,
  Blue
endenum

def Main(): string
  var item = Item.new(Lib.MESSAGE)
  var numbers = [1, 2, 3]
  var doubled = numbers->map((_, value) => Lib.Double(value))
  try
    cache[item.Name()] = Sum(doubled)
  catch /negative/
    return 'failed'
  finally
    echo item.Name()
  endtry
  return $'{item.Name()}: {cache[item.Name()]}'
enddef
