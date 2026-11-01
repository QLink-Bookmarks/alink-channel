import * as Linking from "expo-linking";

/** Opens a saved link's original page with the system handler (native). */
function openLinkUrl(url: string) {
  void Linking.openURL(url);
}

export { openLinkUrl };
