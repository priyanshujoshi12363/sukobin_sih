import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: {
          backgroundColor: '#F9F8F4',
        },
      }}
    >
      <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
      <Stack.Screen name="login" />
      <Stack.Screen name="login-otp" options={{ presentation: 'modal' }} />
      <Stack.Screen name="register" />
      <Stack.Screen name="register-otp" options={{ presentation: 'modal' }} />
    </Stack>
  );
}