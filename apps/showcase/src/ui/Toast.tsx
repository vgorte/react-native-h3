import React from 'react'
import { Animated, Pressable, StyleSheet, Text } from 'react-native'
import { H3Error } from 'react-native-h3'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, radius, space } from './theme'

type Show = (message: string) => void

const ToastContext = React.createContext<{ show: Show }>({
  show: () => undefined,
})

const VISIBLE_MS = 8000

/** Hosts the single toast every screen writes errors into. */
export function ToastProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [message, setMessage] = React.useState<string | null>(null)
  // an absolute child escapes the safe area padding its parent applies
  const insets = useSafeAreaInsets()
  const opacity = React.useRef(new Animated.Value(0)).current
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const hide = React.useCallback(() => {
    Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: true }).start(() =>
      setMessage(null),
    )
  }, [opacity])

  const show = React.useCallback(
    (next: string) => {
      if (timer.current != null) clearTimeout(timer.current)
      setMessage(next)
      Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }).start()
      timer.current = setTimeout(hide, VISIBLE_MS)
    },
    [hide, opacity],
  )

  React.useEffect(
    () => () => {
      if (timer.current != null) clearTimeout(timer.current)
    },
    [],
  )

  const value = React.useMemo(() => ({ show }), [show])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {message == null ? null : (
        <Animated.View style={[styles.toast, { top: insets.top + space.md, opacity }]}>
          <Pressable onPress={hide}>
            <Text style={styles.message}>{message}</Text>
          </Pressable>
        </Animated.View>
      )}
    </ToastContext.Provider>
  )
}

/**
 * Returns the toast writer and the handler an asynchronous call hands to `.catch`.
 *
 * `reportError` shows an {@linkcode H3Error} verbatim and anything else as `Unexpected`, so a
 * failure this app did not plan for still reaches the screen. It never rethrows: a Release build
 * has no rejection tracking, and a throw inside a `.catch` would be lost.
 */
export function useToast(): { show: Show; reportError: (error: unknown) => void } {
  const { show } = React.useContext(ToastContext)
  const reportError = React.useCallback(
    (error: unknown) => {
      if (error instanceof H3Error) {
        show(error.message)
        return
      }
      console.error(error)
      show(`Unexpected: ${error instanceof Error ? error.message : String(error)}`)
    },
    [show],
  )
  return React.useMemo(() => ({ show, reportError }), [reportError, show])
}

/**
 * Returns a wrapper that applies `reportError` to a synchronous call into the package.
 *
 * Every synchronous call goes through it, so no screen decides on its own what to report, and a
 * throw reaches the toast rather than the render. Asynchronous calls hand `reportError` to
 * `.catch` instead.
 */
export function useH3Catch(): (run: () => void) => void {
  const { reportError } = useToast()
  return React.useCallback(
    (run: () => void) => {
      try {
        run()
      } catch (error) {
        reportError(error)
      }
    },
    [reportError],
  )
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: space.md,
    right: space.md,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.danger,
  },
  message: { color: colors.onAccent, fontSize: 13, lineHeight: 18 },
})
