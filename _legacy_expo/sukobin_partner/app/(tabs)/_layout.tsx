import { Tabs } from 'expo-router';
import { View, Platform } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '@/lib/data';

const TabIcon = ({ focused, lib: Lib, name }: any) => (
  <View style={{
    width: 46, height: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: focused ? C.green100 : 'transparent',
  }}>
    <Lib name={name} size={22} color={focused ? C.primary : '#9AA8A0'} />
  </View>
);

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom + 10, 14);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: '#9AA8A0',
        tabBarLabelStyle: { fontSize: 10.5, fontWeight: '700', marginTop: 1 },
        tabBarStyle: {
          position: 'absolute',
          bottom, left: 14, right: 14,
          height: 64, borderRadius: 24, borderTopWidth: 0,
          backgroundColor: '#fff',
          paddingTop: 8,
          shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 12,
        },
        tabBarItemStyle: { paddingVertical: 4 },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: ({ focused }) => <TabIcon focused={focused} lib={Ionicons} name={focused ? 'navigate' : 'navigate-outline'} /> }} />
      <Tabs.Screen name="stats" options={{ title: 'Stats', tabBarIcon: ({ focused }) => <TabIcon focused={focused} lib={MaterialCommunityIcons} name="chart-box-outline" /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ focused }) => <TabIcon focused={focused} lib={Ionicons} name={focused ? 'person' : 'person-outline'} /> }} />
    </Tabs>
  );
}
