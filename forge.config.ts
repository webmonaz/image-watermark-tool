import 'dotenv/config';
import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

const getEnv = (key: string) => {
  const value = process.env[key];
  return value && value.trim().length > 0 ? value.trim() : undefined;
};

const macSignIdentity = getEnv('MAC_SIGN_IDENTITY');
const macBundleId = getEnv('MAC_BUNDLE_ID') ?? 'com.example.imagewatermarktool';
const macNotaryProfile = getEnv('MAC_NOTARIZE_PROFILE');
const macNotaryAppleId = getEnv('MAC_NOTARIZE_APPLE_ID');
const macNotaryPassword = getEnv('MAC_NOTARIZE_PASSWORD');
const macTeamId = getEnv('MAC_TEAM_ID');

const osxSign = macSignIdentity
  ? {
      identity: macSignIdentity,
      hardenedRuntime: true,
      entitlements: 'build/entitlements.mac.plist',
      entitlementsInherit: 'build/entitlements.mac.plist',
      gatekeeperAssess: false,
    }
  : undefined;

const osxNotarize = macNotaryProfile
  ? {
      tool: 'notarytool',
      notarytoolProfile: macNotaryProfile,
    }
  : macNotaryAppleId && macNotaryPassword && macTeamId
    ? {
        tool: 'notarytool',
        appleId: macNotaryAppleId,
        appleIdPassword: macNotaryPassword,
        teamId: macTeamId,
      }
    : undefined;

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    appBundleId: macBundleId,
    osxSign,
    osxNotarize,
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({}),
    new MakerZIP({}, ['win32']),  // ZIP only for Windows as backup
    new MakerDMG({
      format: 'ULFO',  // ULFO format for better compression
      icon: undefined,  // Will use the app icon
      background: undefined,
      additionalDMGOptions: {
        window: {
          size: { width: 540, height: 380 }
        }
      }
    }),
    new MakerRpm({}),
    new MakerDeb({}),
  ],
  plugins: [
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: 'src/main.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
