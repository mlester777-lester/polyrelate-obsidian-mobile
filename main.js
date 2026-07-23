// PolyRelate Bridge (Mobile) — companion to the desktop-only PolyRelate
// Bridge plugin. Only handles one thing: receiving a link from
// PolyRelateShare's "Send to Obsidian" action (iOS), inserting it at the
// cursor in whatever note is currently open, and reporting back which note
// that was so PolyRelate can record the relationship — the same two-way
// exchange the Mac app's Paste Link already does, just triggered from
// PolyRelate's own UI instead of a system-wide hotkey (iOS has no
// equivalent of a hotkey usable from inside another app).
//
// No Electron/Node dependencies at all — require('obsidian') is Obsidian's
// own cross-platform module shim, not real Node require, and is safe on
// mobile. Confirmed live via a throwaway test plugin
// (polyrelate-obsidian-mobile-test) that editor.replaceSelection() via a
// registered protocol handler works correctly on Obsidian iOS.
const { Plugin, Notice } = require('obsidian');

module.exports = class PolyRelateBridgeMobilePlugin extends Plugin {
  async onload() {
    this.registerObsidianProtocolHandler('polyrelate-paste-mobile', async (params) => {
      const editor = this.app.workspace.activeEditor?.editor;
      const file = this.app.workspace.getActiveFile();

      if (!editor || !file) {
        new Notice('PolyRelate: no active note to insert into — open the note you want to link into first.');
        return;
      }

      const toId = params?.to;
      const link = params?.link;
      if (!link) {
        new Notice('PolyRelate: no link was provided.');
        return;
      }

      editor.replaceSelection(link);
      new Notice('PolyRelate: link inserted.');

      // Report back which note this landed in, same shape as the desktop
      // plugin's own callback (vault/path/title/to) — PolyRelate's iOS app
      // uses this to find-or-create the FROM note and record the
      // relationship, exactly mirroring RelationshipStore.record on Mac.
      const callback = 'polyrelate://paste-from'
        + '?vault=' + encodeURIComponent(this.app.vault.getName())
        + '&path='  + encodeURIComponent(file.path)
        + '&title=' + encodeURIComponent(file.basename)
        + '&to='    + encodeURIComponent(toId || '');
      window.open(callback);
    });
  }
};
