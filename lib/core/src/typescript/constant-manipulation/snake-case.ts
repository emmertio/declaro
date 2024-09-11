/**
 * This util converts typescript constants to snake case.
 *
 * Why would anyone do this to themselves? Because now we can take constants defined in one place in one case (i.e. a data type called "User") and we can automatically infer strongly typed dirivative types (i.e. snake case table name) without needing to generate code.
 *
 * Limitations:
 * - This utility is designed to work with typescript constants, not arbitrary strings.
 * - This utility supports only the English alphabet, numerals, and a few special characters (-_ ).
 *
 * Note: This was built with the help of AI (Github Copilot). See adjacent md file for info.
 *
 */

type LowercaseLetters =
    | 'a'
    | 'b'
    | 'c'
    | 'd'
    | 'e'
    | 'f'
    | 'g'
    | 'h'
    | 'i'
    | 'j'
    | 'k'
    | 'l'
    | 'm'
    | 'n'
    | 'o'
    | 'p'
    | 'q'
    | 'r'
    | 's'
    | 't'
    | 'u'
    | 'v'
    | 'w'
    | 'x'
    | 'y'
    | 'z'
type Numerals = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
type UppercaseLetters = Uppercase<LowercaseLetters>
type AllowedSpecialCharacters = ' ' | '_' | '-'
type Letters = LowercaseLetters | UppercaseLetters

type Replace<S extends string, From extends string, To extends string> = S extends ''
    ? ''
    : S extends `${infer P}${From}${infer R}`
    ? `${P}${To}${Replace<R, From, To>}`
    : S

type Trim<S extends string> = S extends `${AllowedSpecialCharacters}${infer T}`
    ? Trim<T>
    : S extends `${infer T}${AllowedSpecialCharacters}`
    ? Trim<T>
    : S

type CamelToSnakeCase<S extends string, Acc extends string = ''> = S extends `${infer L}${infer R}`
    ? L extends LowercaseLetters
        ? `${Acc}${L}` extends `${infer T}${UppercaseLetters}` | `${infer T}${Numerals}`
            ? CamelToSnakeCase<R, `${T}_${Lowercase<L>}`>
            : CamelToSnakeCase<R, `${Acc}${L}`>
        : L extends UppercaseLetters
        ? CamelToSnakeCase<R, `${Acc}_${Lowercase<L>}`>
        : L extends Numerals
        ? `${Acc}` extends `${infer T}${LowercaseLetters}`
            ? CamelToSnakeCase<R, `${Acc}_${L}`>
            : `${Acc}${L}` extends `${infer T}${Numerals}`
            ? CamelToSnakeCase<R, `${T}${L}`>
            : CamelToSnakeCase<R, `${Acc}_${L}`>
        : CamelToSnakeCase<R, Acc>
    : Acc

type Normalize<S extends string> = Lowercase<Trim<Replace<Replace<Replace<S, ' ', '_'>, '-', '_'>, '__', '_'>>>

export type SnakeCase<S extends string> = Normalize<CamelToSnakeCase<S>>
