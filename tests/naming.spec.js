import { describe, expect, test } from 'vitest'
import { convertNaming, splitWords } from '../src/utils/convert/naming.js'

describe('拆词（PRD 4.5.2）', () => {
  test('snake_case 拆词', () => expect(splitWords('user_name')).toEqual(['user', 'name']))
  test('camelCase 拆词', () => expect(splitWords('userName')).toEqual(['user', 'name']))
  test('空格分词', () => expect(splitWords('hello world')).toEqual(['hello', 'world']))
  test('kebab 拆词', () => expect(splitWords('foo-bar')).toEqual(['foo', 'bar']))
  test('连续大写边界：HTTPServer → http server', () => {
    expect(splitWords('HTTPServer')).toEqual(['http', 'server'])
  })
  test('字母数字边界：v2User → v 2 user', () => {
    expect(splitWords('v2User')).toEqual(['v', '2', 'user'])
  })
  test('混合分隔符', () => {
    expect(splitWords('foo-bar_baz.qux')).toEqual(['foo', 'bar', 'baz', 'qux'])
  })
  test('空输入', () => {
    expect(splitWords('')).toEqual([])
  })
})

describe('五种风格输出（PRD 4.5.2 验收）', () => {
  test('user_name 与 userName 输出统一', () => {
    const a = convertNaming('user_name')
    const b = convertNaming('userName')
    expect(a).toEqual(b)
    expect(a.camel).toBe('userName')
    expect(a.pascal).toBe('UserName')
    expect(a.snake).toBe('user_name')
    expect(a.constant).toBe('USER_NAME')
    expect(a.kebab).toBe('user-name')
  })

  test('多词组合', () => {
    const r = convertNaming('hello world example')
    expect(r.camel).toBe('helloWorldExample')
    expect(r.pascal).toBe('HelloWorldExample')
    expect(r.constant).toBe('HELLO_WORLD_EXAMPLE')
    expect(r.kebab).toBe('hello-world-example')
  })

  test('空输入输出空字符串（不报错）', () => {
    const r = convertNaming('')
    expect(r.camel).toBe('')
    expect(r.snake).toBe('')
  })
})
