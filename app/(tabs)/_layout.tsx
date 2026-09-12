import React from 'react';
import { Tabs } from 'expo-router';
import { colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { strings } from '@/constants/strings';

function TabIcon({ name, focused }: { name: keyof typeof Ionicons.glyphMap; focused: boolean }) {
  return <Ionicons name={name} size={focused ? 24 : 22} color={focused ? colors.brandDark : colors.faint} />;
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: colors.brandDark,
      tabBarInactiveTintColor: colors.muted,
      tabBarStyle: { height: 84, paddingTop: 10, paddingBottom: 12, borderTopColor: colors.line, backgroundColor: colors.surface },
      tabBarLabelStyle: { fontSize: 12, fontWeight: '800' }
    }}>
      <Tabs.Screen name="home" options={{ title: strings.tabs.home, tabBarAccessibilityLabel: 'Home tab', tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'home' : 'home-outline'} focused={focused} /> }} />
      <Tabs.Screen name="farm" options={{ title: strings.tabs.farm, tabBarAccessibilityLabel: 'My Farm tab', tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'leaf' : 'leaf-outline'} focused={focused} /> }} />
      <Tabs.Screen name="activity" options={{ title: strings.tabs.activity, tabBarAccessibilityLabel: 'Activity tab', tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'create' : 'create-outline'} focused={focused} /> }} />
      <Tabs.Screen name="insights" options={{ title: strings.tabs.insights, tabBarAccessibilityLabel: 'Insights tab', tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'sunny' : 'sunny-outline'} focused={focused} /> }} />
      <Tabs.Screen name="profile" options={{ title: strings.tabs.profile, tabBarAccessibilityLabel: 'Profile tab', tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'person' : 'person-outline'} focused={focused} /> }} />
    </Tabs>
  );
}
