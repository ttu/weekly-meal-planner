/**
 * Style properties React Native Web understands and React Native's own types
 * do not declare.
 *
 * `outlineStyle` is the only one needed so far: the browser paints its own
 * focus ring over a focused field, in blue, which is the one colour this
 * palette does not contain. The design puts a terracotta edge there instead,
 * and the native outline has to go for it to be seen. The affordance is not
 * lost — it is replaced by a 2px border in the action colour.
 */
import 'react-native'

declare module 'react-native' {
  interface ViewStyle {
    outlineStyle?: 'none' | 'solid' | 'dotted' | 'dashed'
  }
  interface TextStyle {
    outlineStyle?: 'none' | 'solid' | 'dotted' | 'dashed'
  }
}
