const fs = require('fs');

const md = fs.readFileSync('./GatherSync-User-Manual.md', 'utf-8');

let jsx = `import React, { useRef, useState } from 'react';
import { StyleSheet, ScrollView, View, Pressable, Platform, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AdminColors, AdminTypography, AdminSpacing, AdminBorderRadius, AdminShadows } from '@/constants/admin-theme';
import { DesktopLayout } from '@/components/desktop-layout';

export default function UserManualScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const scrollViewRef = useRef<ScrollView>(null);
  const [sectionLayouts, setSectionLayouts] = useState<Record<string, number>>({});

  const handleLayout = (id: string) => (event: any) => {
    const { y } = event.nativeEvent.layout;
    setSectionLayouts(prev => ({ ...prev, [id]: y }));
  };

  const scrollToSection = (id: string) => {
    const y = sectionLayouts[id];
    if (y !== undefined && scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ y, animated: true });
    }
  };

  return (
    <DesktopLayout>
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top + 20, 40) }]}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <IconSymbol name="chevron.left" size={24} color={AdminColors.primary} />
          </Pressable>
          <ThemedText style={styles.headerTitle}>User Manual</ThemedText>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView ref={scrollViewRef} style={styles.content} contentContainerStyle={styles.contentContainer}>
`;

const lines = md.split('\n');
let inList = false;

const generateId = (text) => {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
};

for (let line of lines) {
  if (line.startsWith('---')) {
    jsx += `          <View style={styles.divider} />\n`;
    continue;
  }
  
  if (line.startsWith('# ')) {
    jsx += `          <ThemedText style={styles.h1}>${line.substring(2).replace(/'/g, "&apos;")}</ThemedText>\n`;
  } else if (line.startsWith('## ')) {
    const text = line.substring(3).replace(/'/g, "&apos;");
    const id = generateId(text);
    jsx += `          <View onLayout={handleLayout('${id}')}><ThemedText style={styles.h2}>${text}</ThemedText></View>\n`;
  } else if (line.startsWith('### ')) {
    const text = line.substring(4).replace(/'/g, "&apos;");
    const id = generateId(text);
    jsx += `          <View onLayout={handleLayout('${id}')}><ThemedText style={styles.h3}>${text}</ThemedText></View>\n`;
  } else if (line.match(/^[0-9]+\.\s\[(.*?)\]\((.*?)\)/)) {
    // ToC link
    const match = line.match(/^[0-9]+\.\s\[(.*?)\]\((.*?)\)/);
    const text = match[1].replace(/'/g, "&apos;");
    const linkId = match[2].replace('#', '');
    jsx += `          <Pressable onPress={() => scrollToSection('${linkId}')} style={({pressed}) => [styles.tocLink, pressed && {opacity: 0.7}]}>
            <ThemedText style={styles.tocLinkText}>• ${text}</ThemedText>
          </Pressable>\n`;
  } else if (line.match(/^[0-9]+\.\s/)) {
    // Numbered list
    let text = line.replace(/^[0-9]+\.\s/, '').replace(/'/g, "&apos;");
    text = text.replace(/\*\*(.*?)\*\*/g, '<ThemedText style={{fontWeight: "bold"}}>$1</ThemedText>');
    text = text.replace(/\*(.*?)\*/g, '<ThemedText style={{fontStyle: "italic"}}>$1</ThemedText>');
    jsx += `          <View style={styles.listItem}><ThemedText style={styles.listBullet}>•</ThemedText><ThemedText style={styles.paragraph}>${text}</ThemedText></View>\n`;
  } else if (line.startsWith('* ') || line.startsWith('- ')) {
    // Bullet list
    let text = line.substring(2).replace(/'/g, "&apos;");
    text = text.replace(/\*\*(.*?)\*\*/g, '<ThemedText style={{fontWeight: "bold"}}>$1</ThemedText>');
    text = text.replace(/\*(.*?)\*/g, '<ThemedText style={{fontStyle: "italic"}}>$1</ThemedText>');
    jsx += `          <View style={styles.listItem}><ThemedText style={styles.listBullet}>-</ThemedText><ThemedText style={styles.paragraph}>${text}</ThemedText></View>\n`;
  } else if (line.trim() !== '') {
    // Paragraph
    let text = line.replace(/'/g, "&apos;");
    text = text.replace(/\*\*(.*?)\*\*/g, '<ThemedText style={{fontWeight: "bold"}}>$1</ThemedText>');
    text = text.replace(/\*(.*?)\*/g, '<ThemedText style={{fontStyle: "italic"}}>$1</ThemedText>');
    jsx += `          <ThemedText style={styles.paragraph}>${text}</ThemedText>\n`;
  }
}

jsx += `        </ScrollView>
      </View>
    </DesktopLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AdminColors.gray50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: AdminSpacing.xl,
    paddingBottom: AdminSpacing.xl,
    backgroundColor: AdminColors.surface,
    ...Platform.select({
      web: { boxShadow: AdminShadows.sm },
      default: { elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 },
    }),
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: AdminColors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: AdminTypography.xl,
    fontWeight: 'bold',
    color: AdminColors.gray900,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: AdminSpacing.xl,
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
    paddingBottom: 100,
  },
  h1: {
    fontSize: 28,
    fontWeight: 'bold',
    color: AdminColors.gray900,
    marginTop: 24,
    marginBottom: 16,
  },
  h2: {
    fontSize: 22,
    fontWeight: 'bold',
    color: AdminColors.gray900,
    marginTop: 32,
    marginBottom: 12,
  },
  h3: {
    fontSize: 18,
    fontWeight: '600',
    color: AdminColors.gray800,
    marginTop: 24,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 16,
    color: AdminColors.gray700,
    lineHeight: 24,
    marginBottom: 12,
  },
  listItem: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingLeft: 8,
  },
  listBullet: {
    fontSize: 16,
    color: AdminColors.gray700,
    marginRight: 8,
    lineHeight: 24,
  },
  divider: {
    height: 1,
    backgroundColor: AdminColors.gray200,
    marginVertical: 24,
  },
  tocLink: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 4,
    borderRadius: 8,
    backgroundColor: AdminColors.primaryLight,
  },
  tocLinkText: {
    fontSize: 16,
    color: AdminColors.primary,
    fontWeight: '600',
  },
});
`;

fs.writeFileSync('./app/user-manual.tsx', jsx);
