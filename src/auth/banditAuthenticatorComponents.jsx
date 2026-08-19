import React from 'react'
import { Button, Flex, Heading, Text, useAuthenticator, useTheme, View } from '@aws-amplify/ui-react'
import {
  getPreferRememberUsername,
  setPreferRememberUsername,
} from './rememberUsername'

function RememberUsernameToggle() {
  const { tokens } = useTheme()
  const [checked, setChecked] = React.useState(() => getPreferRememberUsername())

  return (
    <Flex
      className="bandit-remember-username"
      alignItems="center"
      justifyContent="center"
      gap={tokens.space.xs}
      padding={`${tokens.space.xs} 0 ${tokens.space.xxs} 0`}
      as="label"
      style={{ cursor: 'pointer', flexDirection: 'row' }}
    >
      <input
        type="checkbox"
        name="rememberUsername"
        checked={checked}
        onChange={(event) => {
          const next = event.target.checked
          setChecked(next)
          setPreferRememberUsername(next)
        }}
        style={{ margin: 0, flexShrink: 0 }}
      />
      <Text fontSize={tokens.fontSizes.small} color={tokens.colors.font.secondary}>
        Remember username
      </Text>
    </Flex>
  )
}

export const banditAuthenticatorComponents = {
  SignIn: {
    Header() {
      const { tokens } = useTheme()
      return (
        <Heading
          level={5}
          padding={`${tokens.space.medium} 0 ${tokens.space.small} 0`}
          textAlign="center"
          fontWeight="600"
        >
          Sign in to Console
        </Heading>
      )
    },
    Footer() {
      const { toForgotPassword } = useAuthenticator()
      const { tokens } = useTheme()

      return (
        <View textAlign="center" padding={`${tokens.space.small} 0 0 0`}>
          <RememberUsernameToggle />
          <Button fontWeight="normal" onClick={toForgotPassword} size="small" variation="link">
            Reset password
          </Button>
        </View>
      )
    },
  },
  ForgotPassword: {
    Header() {
      return (
        <Heading level={5} padding="medium 0 small 0" textAlign="center" fontWeight="600">
          Reset password
        </Heading>
      )
    },
  },
  ConfirmResetPassword: {
    Header() {
      return (
        <Heading level={5} padding="medium 0 small 0" textAlign="center" fontWeight="600">
          Choose a new password
        </Heading>
      )
    },
  },
  ConfirmSignIn: {
    Header() {
      return (
        <Heading level={5} padding="medium 0 small 0" textAlign="center" fontWeight="600">
          Multi-factor authentication
        </Heading>
      )
    },
    Footer() {
      const { tokens } = useTheme()
      return (
        <Text textAlign="center" color={tokens.colors.font.secondary} fontSize={tokens.fontSizes.small}>
          Enter the verification code from your authenticator app or SMS.
        </Text>
      )
    },
  },
}
