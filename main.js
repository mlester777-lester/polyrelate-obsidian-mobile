// LesterMark Bridge (Mobile) — companion to the desktop-only LesterMark
// Bridge plugin. Renamed from "PolyRelate Bridge (Mobile)" — plugin id
// (polyrelate-bridge-mobile) deliberately kept unchanged, same reasoning as
// every other identifier in this project that BRAT/external tooling tracks:
// renaming it would make BRAT treat this as a brand-new plugin install
// rather than an update, since there's no ObsidianPluginInstaller-style
// auto-cleanup possible for a BRAT-distributed mobile plugin the way there
// is for Mac's own plugin. Only user-facing text changed.
//
// Handles three ways of connecting Obsidian iOS to LesterMark — the first
// two are the same two-way exchange the Mac app's Paste Link already does,
// just triggered from LesterMark's own UI (or the clipboard) instead of a
// system-wide hotkey (iOS has no equivalent of a hotkey usable from inside
// another app); the third mirrors Mac's own Capture for the active note:
//
//   1. registerObsidianProtocolHandler('polyrelate-paste-mobile', ...) —
//      LesterMarkShare's "Paste Link (from Bookmark)" action pushes a link
//      straight in via this URL scheme. Protocol-handler action name
//      deliberately NOT renamed — internal plumbing, never user-facing,
//      same "don't rename what nobody sees" reasoning as Mac's own
//      obsidian://linklayer-bridge action names.
//   2. addCommand('paste-link') — a Command Palette entry ("Paste Link")
//      for when you're already in Obsidian and want to pull in whatever's
//      on the clipboard, rather than switching back to LesterMark first.
//      Reuses the exact same clipboard mechanism "Stage for Paste Link"
//      already writes to — a Command running inside Obsidian's plugin
//      sandbox has no way to reach LesterMark's shared container directly,
//      so the clipboard (already proven to work manually) is the one
//      channel available without inventing new shared storage.
//   3. addCommand('capture-note') — a Command Palette entry ("Capture
//      current note") that hands the active note's vault/path/title to
//      LesterMark via lestermark://create-obsidian, the exact same host
//      Mac's own Obsidian plugin already calls for its own Capture
//      (ObsidianAdapter.createFromPolyRelateCallback) — LesterMark creates
//      or re-affirms the OBS object as a real, explicit Capture
//      (wasCaptured/capturedAt set), then bounces straight back to this
//      same note in Obsidian, same "blip, not a real app-switch" pattern
//      paste-from already uses. No NoteCaptureCoordinator-style popup here
//      — no iOS equivalent exists, and a silent create-and-bounce-back
//      matches this plugin's own established Notice()-based feedback
//      instead of introducing new UI.
//
// No Electron/Node dependencies at all — require('obsidian') is Obsidian's
// own cross-platform module shim, not real Node require, and is safe on
// mobile. Confirmed live via a throwaway test plugin
// (polyrelate-obsidian-mobile-test) that editor.replaceSelection() via a
// registered protocol handler works correctly on Obsidian iOS.
const { Plugin, Notice } = require('obsidian');

// Matches LesterMark's markdown link format: [Type: Title](lestermark://open/ID)
// or the permanently-accepted legacy polyrelate:// / linklayer:// schemes.
// Captures the object ID so the relationship can be recorded the same way
// the protocol-handler path does.
const LINK_PATTERN = /\[[^\]]*\]\(\s*(?:polyrelate|linklayer|lestermark):\/\/open\/([A-Za-z0-9-]+)\s*\)/;

module.exports = class LesterMarkBridgeMobilePlugin extends Plugin {
  async onload() {
    this.registerObsidianProtocolHandler('polyrelate-paste-mobile', async (params) => {
      const link = params?.link;
      const toId = params?.to;
      if (!link) {
        new Notice('LesterMark: no link was provided.');
        return;
      }
      this.insertAndReportBack(link, toId);
    });

    this.addCommand({
      id: 'paste-link',
      name: 'Paste Link',
      editorCallback: async (editor) => {
        let clipboardText;
        try {
          clipboardText = await navigator.clipboard.readText();
        } catch (e) {
          new Notice('LesterMark: could not read the clipboard. If iOS showed a paste-permission prompt, allow it and try again.');
          return;
        }

        const match = clipboardText.match(LINK_PATTERN);
        if (!match) {
          new Notice('LesterMark: no LesterMark link found on the clipboard. Use "Stage for Paste Link" (or "Paste Link (from Bookmark)") on iPhone first, then run this command.');
          return;
        }

        editor.replaceSelection(clipboardText.trim());
        this.reportBack(match[1]);
      },
    });

    this.addCommand({
      id: 'capture-note',
      name: 'Capture current note',
      callback: () => {
        const file = this.app.workspace.getActiveFile();
        if (!file) {
          new Notice('LesterMark: no active note to capture — open the note you want to capture first.');
          return;
        }
        const vault = this.app.vault.getName();
        const url = 'lestermark://create-obsidian'
          + '?vault=' + encodeURIComponent(vault)
          + '&file='  + encodeURIComponent(file.path)
          + '&title=' + encodeURIComponent(file.basename);
        window.open(url);
      },
    });
  }

  /// Shared by both Paste Link entry points: insert at cursor, notify, then
  /// report back which note this landed in — mirrors
  /// RelationshipStore.record/recordLinkInto on Mac exactly (see
  /// MobileObjectStore.recordRelation, the iOS-side equivalent).
  insertAndReportBack(link, toId) {
    const editor = this.app.workspace.activeEditor?.editor;
    const file = this.app.workspace.getActiveFile();
    if (!editor || !file) {
      new Notice('LesterMark: no active note to insert into — open the note you want to link into first.');
      return;
    }
    editor.replaceSelection(link);
    new Notice('LesterMark: link inserted.');
    this.reportBack(toId);
  }

  reportBack(toId) {
    const file = this.app.workspace.getActiveFile();
    if (!file || !toId) return;
    const callback = 'lestermark://paste-from'
      + '?vault=' + encodeURIComponent(this.app.vault.getName())
      + '&path='  + encodeURIComponent(file.path)
      + '&title=' + encodeURIComponent(file.basename)
      + '&to='    + encodeURIComponent(toId);
    window.open(callback);
  }
};
