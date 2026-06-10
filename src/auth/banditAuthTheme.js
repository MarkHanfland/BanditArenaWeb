import { createTheme } from '@aws-amplify/ui-react'

export const banditAuthTheme = createTheme({
  name: 'bandit-arena-auth',
  tokens: {
    fonts: {
      default: {
        variable: { value: "'Montserrat', 'Helvetica', 'Arial', sans-serif" },
        static: { value: "'Montserrat', 'Helvetica', 'Arial', sans-serif" },
      },
    },
    colors: {
      brand: {
        primary: {
          10: { value: '#1a3a40' },
          20: { value: '#245860' },
          40: { value: '#2a8a96' },
          60: { value: '#4db6c4' },
          80: { value: '#7ed4df' },
          90: { value: '#a8e4ec' },
          100: { value: '#d4f2f6' },
        },
      },
      background: {
        primary: { value: '#181c20' },
        secondary: { value: '#23272b' },
      },
      font: {
        primary: { value: '#e0e0e0' },
        secondary: { value: '#b0bec5' },
      },
    },
    components: {
      authenticator: {
        router: {
          boxShadow: { value: 'none' },
          borderWidth: { value: '0' },
          backgroundColor: { value: 'transparent' },
        },
        form: {
          padding: { value: '0' },
        },
      },
      button: {
        primary: {
          backgroundColor: { value: '{colors.brand.primary.60}' },
          color: { value: '#ffffff' },
          _hover: {
            backgroundColor: { value: '{colors.brand.primary.80}' },
          },
        },
        link: {
          color: { value: '{colors.brand.primary.80}' },
        },
      },
      field: {
        label: {
          color: { value: '{colors.font.secondary}' },
        },
      },
      fieldcontrol: {
        borderColor: { value: 'rgba(255,255,255,0.22)' },
        color: { value: '{colors.font.primary}' },
        _focus: {
          borderColor: { value: '{colors.brand.primary.60}' },
          boxShadow: { value: '0 0 0 2px rgba(77, 182, 196, 0.35)' },
        },
      },
      tabs: {
        item: {
          color: { value: '{colors.font.secondary}' },
          _active: {
            borderColor: { value: '{colors.brand.primary.60}' },
            color: { value: '{colors.font.primary}' },
          },
        },
      },
    },
  },
})
