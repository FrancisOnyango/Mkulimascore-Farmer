import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, layout } from '@/constants/theme';
import { getStrings } from '@/constants/strings';
import { useAppData } from '@/context/AppDataContext';
import { useMobileLayout } from '@/hooks/useMobileLayout';

function TabIcon({ name, focused }: { name: keyof typeof Ionicons.glyphMap; focused: boolean }) {
  return (
    <Ionicons
      name={name}
      size={focused ? layout.tabBarIcon + 1 : layout.tabBarIcon}
      color={focused ? colors.brandDark : colors.faint}
    />
  );
}

export default function TabsLayout() {
  const { settings } = useAppData();
  const strings = getStrings(settings.language);
  const { tabBarHeight, tabBottomInset, narrow } = useMobileLayout();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandDark,
        tabBarInactiveTintColor: colors.muted,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          height: tabBarHeight,
          paddingTop: 4,
          paddingBottom: tabBottomInset,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.line,
          backgroundColor: colors.surface,
          elevation: 8,
          shadowColor: '#0B1A10',
          shadowOpacity: Platform.OS === 'ios' ? 0.06 : 0.12,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: -2 }
        },
        tabBarItemStyle: {
          paddingTop: 2,
          paddingBottom: 0
        },
        tabBarLabelStyle: {
          fontSize: narrow ? 9 : layout.tabBarLabel,
          fontWeight: '700',
          marginTop: 1,
          marginBottom: 0
        },
        tabBarLabelPosition: 'below-icon'
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: strings.tabs.home,
          tabBarAccessibilityLabel: strings.tabs.home,
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'home' : 'home-outline'} focused={focused} />
        }}
      />
      <Tabs.Screen
        name="farm"
        options={{
          title: strings.tabs.farm,
          tabBarAccessibilityLabel: strings.tabs.farm,
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'leaf' : 'leaf-outline'} focused={focused} />
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: strings.tabs.activity,
          tabBarAccessibilityLabel: strings.tabs.activity,
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'create' : 'create-outline'} focused={focused} />
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: strings.tabs.insights,
          tabBarAccessibilityLabel: strings.tabs.insights,
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'sunny' : 'sunny-outline'} focused={focused} />
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: strings.tabs.profile,
          tabBarAccessibilityLabel: strings.tabs.profile,
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'person' : 'person-outline'} focused={focused} />
        }}
      />
    </Tabs>
  );
}
