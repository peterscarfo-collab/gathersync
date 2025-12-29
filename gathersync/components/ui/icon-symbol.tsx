// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight, SymbolViewProps } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type IconMapping = Record<SymbolViewProps["name"], ComponentProps<typeof MaterialIcons>["name"]>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  "house.fill": "home",
  "paperplane.fill": "send",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron-right",
  "wifi.slash": "wifi-off",
  "exclamationmark.triangle.fill": "warning",
  "arrow.triangle.2.circlepath": "sync",
  "checkmark.circle.fill": "check-circle",
  "person.2.fill": "people",
  "person.fill": "person",
  "mappin": "place",
  "map.fill": "map",
  "phone.fill": "phone",
  "video.fill": "videocam",
  "doc.on.doc": "content-copy",
  "clock.fill": "schedule",
  "note.text": "description",
  "calendar": "calendar-today",
  "calendar.badge.plus": "event",
  "person.badge.plus": "person-add",
  "cloud": "cloud",
  "star.fill": "star",
  "bookmark.fill": "bookmark",
  "square.and.arrow.up": "share",
  "trash.fill": "delete",
  "plus": "add",
  "chevron.left": "chevron-left",
  "info.circle": "info",
  "checkmark": "check",
  "xmark": "close",
  "ellipsis.circle": "more-horiz",
  "person.text.rectangle": "contacts",
  "pencil": "edit",
  "magnifyingglass": "search",
  "message.fill": "message",
  "gearshape.fill": "settings",
  "lock.fill": "lock",
  "chart.bar.fill": "bar-chart",
  "arrow.down.doc": "download",
  "arrow.up.doc": "upload",
  "wrench.and.screwdriver": "build",
  "arrow.clockwise": "refresh",
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
