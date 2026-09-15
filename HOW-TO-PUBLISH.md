# How to Publish Privacy Policy on GitHub Pages

This guide shows you how to upload the privacy policy page to your GitHub repo
`Monessem/Ask-Duck.ai` so it's accessible at:
**`https://monessem.github.io/Ask-Duck.ai/privacy.html`**

## What's in this folder

```
github-pages/
├── index.html          ← Landing page for the extension
├── privacy.html        ← Privacy policy page
├── PRIVACY.md          ← Markdown version (for repo reference)
└── icons/
    ├── icon-48.png
    └── icon-128.png
```

---

## Method 1: Upload via GitHub Web UI (Easiest — No Git)

1. **Download** the `Ask-Duck.ai-github-pages.zip` file (in the parent folder)
2. **Unzip** it locally — you'll get a folder with `index.html`, `privacy.html`, `PRIVACY.md`, and `icons/`
3. Go to your repo: **https://github.com/Monessem/Ask-Duck.ai**
4. Click **Add file → Upload files**
5. Drag the **entire contents** of the unzipped folder into the upload area
   - Drag `index.html`, `privacy.html`, `PRIVACY.md`, and the `icons` folder
6. In the "Commit changes" section:
   - Commit message: `Add privacy policy and landing page`
   - Select **Commit directly to the main branch**
7. Click **Commit changes**

---

## Method 2: Use Git Command Line

If you have the repo cloned locally:

```bash
# 1. Navigate to your local repo
cd /path/to/Ask-Duck.ai

# 2. Copy the files from this github-pages folder
# (Copy index.html, privacy.html, PRIVACY.md, and the icons/ folder
#  into the root of your repo, OR into a docs/ folder)

# 3. Add and commit
git add index.html privacy.html PRIVACY.md icons/
git commit -m "Add privacy policy and landing page"

# 4. Push to GitHub
git push origin main
```

---

## Enable GitHub Pages

After uploading the files:

1. Go to your repo: **https://github.com/Monessem/Ask-Duck.ai**
2. Click **Settings** (top right of the repo page)
3. In the left sidebar, click **Pages**
4. Under **"Build and deployment"**:
   - **Source**: select **Deploy from a branch**
   - **Branch**: select **main** and **/(root)** folder
   - Click **Save**
5. Wait 1-2 minutes for GitHub to build the page

---

## Verify

After GitHub Pages is enabled:

1. Go to **https://monessem.github.io/Ask-Duck.ai/privacy.html**
   - You should see the privacy policy page
2. Go to **https://monessem.github.io/Ask-Duck.ai/**
   - You should see the landing page with the extension logo
3. Test on mobile — the pages are responsive

---

## Update Chrome Web Store Listing

Once the privacy page is live:

1. Go to **Chrome Web Store Developer Dashboard**
2. Click on your extension → **Package** tab
3. In the **Privacy Policy** field, enter:
   ```
   https://monessem.github.io/Ask-Duck.ai/privacy.html
   ```
4. Click **Save**

---

## Update Firefox AMO Listing

1. Go to **addons.mozilla.org/developers/**
2. Click on your extension → **Edit Listing**
3. Scroll to **Privacy Policy** section
4. Enter the URL:
   ```
   https://monessem.github.io/Ask-Duck.ai/privacy.html
   ```
5. Click **Save Changes**

---

## Troubleshooting

**Page shows 404:**
- Wait 2-3 minutes after enabling GitHub Pages
- Check that `privacy.html` is in the **root** of the `main` branch
- Check Settings → Pages to confirm it says "Your site is published"

**Icons don't load:**
- Make sure the `icons` folder is uploaded with `icon-48.png` and `icon-128.png`
- Check that the URL is correct: `https://monessem.github.io/Ask-Duck.ai/icons/icon-128.png`

**Page looks unstyled:**
- This is normal if CSS is blocked by your browser — try incognito mode
- The page uses inline CSS, so it should work without external dependencies
