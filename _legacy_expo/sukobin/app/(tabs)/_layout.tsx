import { Tabs } from 'expo-router';
import { View, Text, Platform, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ── Types ──────────────────────────────────────────────────────────────────
type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];
type MCIName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

// ── Tab icon wrapper with pill highlight ───────────────────────────────────
const TabIcon = ({
  focused,
  children,
}: {
  focused: boolean;
  children: React.ReactNode;
}) => (
  <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
    {children}
  </View>
);

// ── Blur background for iOS — frosted glass effect ─────────────────────────
const TabBarBackground = () => (
  <BlurView
    intensity={60}
    tint="light"
    style={StyleSheet.absoluteFill}
  />
);

// ── Layout ─────────────────────────────────────────────────────────────────
export default function TabLayout() {
  const insets = useSafeAreaInsets();
  // Sit 12px above the home indicator; never less than 16px from screen bottom
  const bottomOffset = Math.max(insets.bottom + 12, 16);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,

        // Frosted glass on iOS, solid on Android
        tabBarBackground: Platform.OS === 'ios' ? () => <TabBarBackground /> : undefined,

        tabBarStyle: {
          position: 'absolute',
          bottom: bottomOffset,
          left: 14,
          right: 14,
          height: 62,
          borderRadius: 28,
          borderTopWidth: 0,
          // iOS: transparent so BlurView shows through
          backgroundColor: Platform.OS === 'ios'
            ? 'rgba(255, 255, 255, 0.75)'
            : 'rgba(255, 255, 255, 0.97)',
          // Subtle border for glass edge
          borderWidth: 0.5,
          borderColor: 'rgba(255, 255, 255, 0.9)',
          // Shadow
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.12,
          shadowRadius: 20,
          elevation: 12,
          overflow: 'hidden', // clips BlurView to rounded corners
        },

        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '500',
          letterSpacing: 0.1,
          marginTop: 1,
        },

        tabBarActiveTintColor: '#1A3B32',
        tabBarInactiveTintColor: '#9CA3AF',

        tabBarItemStyle: {
          paddingVertical: 6,
        },

        // Push content up so it isn't hidden under the floating tab bar
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused}>
              <Ionicons
                name={focused ? 'home' : 'home-outline'}
                size={22}
                color={color}
              />
            </TabIcon>
          ),
        }}
      />

      <Tabs.Screen
        name="parcel"
        options={{
          title: 'Parcel',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused}>
              <MaterialCommunityIcons
                name={focused ? 'package-variant-closed' : 'package-variant-closed-remove'}
                size={22}
                color={color}
              />
            </TabIcon>
          ),
        }}
      />

      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused}>
              <MaterialCommunityIcons
                name={focused ? 'clipboard-list' : 'clipboard-list-outline'}
                size={22}
                color={color}
              />
            </TabIcon>
          ),
        }}
      />

      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused}>
              <Ionicons
                name={focused ? 'time' : 'time-outline'}
                size={22}
                color={color}
              />
            </TabIcon>
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused}>
              <Ionicons
                name={focused ? 'person' : 'person-outline'}
                size={22}
                color={color}
              />
            </TabIcon>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 38,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: '#DDFBE6',
  },
});