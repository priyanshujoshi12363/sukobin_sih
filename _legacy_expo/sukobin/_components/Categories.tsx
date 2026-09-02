import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  StyleSheet,
} from 'react-native';
import api from '@/utils/api';

interface Category {
  name: string;
  count?: number;
}

interface CategoriesProps {
  activeCategory: string;
  onCategoryPress: (category: string) => void;
}

// ── Skeleton chip ──────────────────────────────────────────────────────────
const SkeletonChip = ({ width }: { width: number }) => {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1,   duration: 700, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[styles.chip, styles.skeletonChip, { width, opacity }]}
    />
  );
};

// ── Category chip ──────────────────────────────────────────────────────────
const CategoryChip = ({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count?: number;
  active: boolean;
  onPress: () => void;
}) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () =>
    Animated.spring(scale, { toValue: 0.93, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
  const handlePressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 4 }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
      >
        {active && <View style={styles.activeDot} />}
        <Text style={[styles.chipText, active ? styles.chipTextActive : styles.chipTextInactive]}>
          {label}
        </Text>
        {count !== undefined && (
          <View style={[styles.countBadge, active ? styles.countBadgeActive : styles.countBadgeInactive]}>
            <Text style={[styles.countText, active ? styles.countTextActive : styles.countTextInactive]}>
              {count}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

// ── Main component ─────────────────────────────────────────────────────────
export default function Categories({ activeCategory, onCategoryPress }: CategoriesProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'empty'>('loading');

  const fetchCategories = useCallback(async () => {
    setStatus('loading');
    try {
      const response = await api.get('/api/user/product/categories');
      if (response.success) {
        const cats: Category[] = (response.data.categories ?? []).map(
          (c: string | Category) => (typeof c === 'string' ? { name: c } : c)
        );
        setCategories(cats);
        setStatus(cats.length === 0 ? 'empty' : 'success');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Browse</Text>
          <Text style={styles.title}>Shop by category</Text>
        </View>
      </View>

      {/* Loading */}
      {status === 'loading' && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          scrollEnabled={false}
        >
          {[52, 88, 74, 96, 68].map((w, i) => (
            <SkeletonChip key={i} width={w} />
          ))}
        </ScrollView>
      )}

      {/* Success */}
      {status === 'success' && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <CategoryChip
            label="All"
            active={activeCategory === 'All'}
            onPress={() => onCategoryPress('All')}
          />
          {categories.map((cat) => (
            <CategoryChip
              key={cat.name}
              label={cat.name}
              count={cat.count}
              active={activeCategory === cat.name}
              onPress={() => onCategoryPress(cat.name)}
            />
          ))}
        </ScrollView>
      )}

      {/* Error */}
      {status === 'error' && (
        <View style={styles.feedbackRow}>
          <Text style={styles.feedbackText}>Couldn't load categories</Text>
          <TouchableOpacity onPress={fetchCategories} style={styles.retryBtn} activeOpacity={0.7}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Empty */}
      {status === 'empty' && (
        <View style={styles.feedbackRow}>
          <Text style={styles.feedbackText}>No categories yet</Text>
        </View>
      )}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const BRAND = '#1A3B32';

const styles = StyleSheet.create({
  root:         { paddingTop: 16 },
  header:       { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
                  paddingHorizontal: 20, marginBottom: 12 },
  eyebrow:      { fontSize: 11, fontWeight: '500', letterSpacing: 0.9,
                  textTransform: 'uppercase', color: '#888', marginBottom: 2 },
  title:        { fontSize: 17, fontWeight: '600', color: BRAND },

  scrollContent: { paddingHorizontal: 20, paddingBottom: 16, gap: 8 },

  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 7, paddingHorizontal: 16,
    borderRadius: 100, borderWidth: 1, height: 34,
  },
  chipActive:   { backgroundColor: BRAND, borderColor: BRAND },
  chipInactive: { backgroundColor: '#fff', borderColor: '#E5E7EB' },

  activeDot:    { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.55)' },

  chipText:     { fontSize: 13, fontWeight: '500' },
  chipTextActive:   { color: '#fff' },
  chipTextInactive: { color: BRAND },

  countBadge:   { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 99 },
  countBadgeActive:   { backgroundColor: 'rgba(255,255,255,0.18)' },
  countBadgeInactive: { backgroundColor: 'rgba(26,59,50,0.09)' },
  countText:    { fontSize: 11, fontWeight: '500', lineHeight: 15 },
  countTextActive:   { color: 'rgba(255,255,255,0.85)' },
  countTextInactive: { color: BRAND },

  skeletonChip: { backgroundColor: '#E5E7EB', borderColor: 'transparent' },

  feedbackRow:  { flexDirection: 'row', alignItems: 'center', gap: 8,
                  paddingHorizontal: 20, paddingBottom: 16 },
  feedbackText: { fontSize: 13, color: '#9CA3AF' },
  retryBtn:     { marginLeft: 'auto', paddingHorizontal: 12, paddingVertical: 4,
                  borderRadius: 99, borderWidth: 1, borderColor: BRAND },
  retryText:    { fontSize: 12, fontWeight: '500', color: BRAND },
});