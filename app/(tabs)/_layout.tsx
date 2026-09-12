import React from 'react';
import { Tabs } from 'expo-router';
import { colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { getStrings } from '@/constants/strings';
import { useAppData } from '@/context/AppDataContext';

function TabIcon({ name, focused }: { name: keyof typeof Ionicons.glyphMap; focused: boolean }) {
  return <Ionicons name={name} size={focused ? 24 : 22} color={focused ? colors.brandDark : colors.faint} />;
}

export default function TabsLayout() {
  const { settings } = useAppData();
  const strings = getStrings(settings.language);
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: colors.brandDark,
      tabBarInactiveTintColor: colors.muted,
      tabBarStyle: { height: 84, paddingTop: 10, paddingBottom: 12, borderTopColor: colors.line, backgroundColor: colors.surface },
      tabBarLabelStyle: { fontSize: 12, fontWeight: '800' }
    }}>
      <Tabs.Screen name="home" options={{ title: strings.tabs.home, tabBarAccessibilityLabel: strings.tabs.home, tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'home' : 'home-outline'} focused={focused} /> }} />
      <Tabs.Screen name="farm" options={{ title: strings.tabs.farm, tabBarAccessibilityLabel: strings.tabs.farm, tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'leaf' : 'leaf-outline'} focused={focused} /> }} />
      <Tabs.Screen name="activity" options={{ title: strings.tabs.activity, tabBarAccessibilityLabel: strings.tabs.activity, tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'create' : 'create-outline'} focused={focused} /> }} />
      <Tabs.Screen name="insights" options={{ title: strings.tabs.insights, tabBarAccessibilityLabel: strings.tabs.insights, tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'sunny' : 'sunny-outline'} focused={focused} /> }} />
      <Tabs.Screen name="profile" options={{ title: strings.tabs.profile, tabBarAccessibilityLabel: strings.tabs.profile, tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'person' : 'person-outline'} focused={focused} /> }} />
    </Tabs>
  );
}
