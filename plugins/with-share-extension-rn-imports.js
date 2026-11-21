const { withMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const addRootView = "      view.addSubview(reactNativeRootView)";
const configureRootView =
  "      configureRootView(reactNativeRootView, withBackgroundColorDict: backgroundFromInfoPlist, withHeight: heightFromInfoPlist)";
const rootViewSetup = `${configureRootView}\n${addRootView}`;

const rootViewLayout =
  /    \/\/ Get the screen bounds\n    let screenBounds = UIScreen\.main\.bounds[\s\S]*?\n    rootView\.frame = frame/;

const hostLayout = `    rootView.translatesAutoresizingMaskIntoConstraints = false
    NSLayoutConstraint.activate([
      rootView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      rootView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      rootView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
      rootView.topAnchor.constraint(greaterThanOrEqualTo: view.topAnchor)
    ])

    if let withHeight = withHeight {
      let height = rootView.heightAnchor.constraint(equalToConstant: withHeight)
      height.priority = UILayoutPriority(999)
      height.isActive = true
    } else {
      rootView.topAnchor.constraint(equalTo: view.topAnchor).isActive = true
    }`;

module.exports = function withShareExtensionRnImports(config) {
  return withMod(config, {
    platform: "ios",
    mod: "finalized",
    action: (config) => {
      const iosDir = config.modRequest.platformProjectRoot;
      for (const entry of fs.readdirSync(iosDir)) {
        if (!entry.endsWith("ShareExtension")) continue;
        const swiftPath = path.join(iosDir, entry, "ShareExtensionViewController.swift");
        if (!fs.existsSync(swiftPath)) continue;
        let contents = fs.readFileSync(swiftPath, "utf8");
        if (!contents.includes("#if canImport(React_RCTAppDelegate)")) {
          contents = contents.replace(
            /^import React_RCTAppDelegate$/m,
            "#if canImport(React_RCTAppDelegate)\nimport React_RCTAppDelegate\n#endif",
          );
        }
        if (!contents.includes(hostLayout)) {
          if (!contents.includes(rootViewSetup) || !rootViewLayout.test(contents)) {
            throw new Error(
              `Could not locate the share extension root view layout in ${swiftPath}`,
            );
          }
          contents = contents
            .replace(rootViewSetup, `${addRootView}\n${configureRootView}`)
            .replace(rootViewLayout, hostLayout);
        }
        fs.writeFileSync(swiftPath, contents);
      }
      return config;
    },
  });
};
