import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,

        animation: "slide_from_right",

        contentStyle: {
          backgroundColor: "#F8FFF9",
        },

        gestureEnabled: true,
        fullScreenGestureEnabled: true,
      }}
    >
      <Stack.Screen
        name="welcome"
        options={{
          animation: "fade",
        }}
      />

      <Stack.Screen
        name="register"
        options={{
          animation: "slide_from_right",
        }}
      />

      <Stack.Screen
        name="login"
        options={{
          animation: "slide_from_right",
        }}
      />

       <Stack.Screen
          name="otp-register"
          options={{
            animation: 'slide_from_bottom',
            presentation: 'modal',
          }}
        />

        <Stack.Screen
          name="otp-login"
          options={{
            animation: 'slide_from_bottom',
            presentation: 'modal',
          }}
        />


      <Stack.Screen
        name="complete-profile"
        options={{
          animation: "slide_from_right",
        }}
      />

    </Stack>
  );
}