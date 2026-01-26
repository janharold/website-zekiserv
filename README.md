# Serving — Agency Website

A minimalist single-page website for a web design and development agency. Black and white, centered layout.

## Sections

1. **Hero** — Black background with a DVD-style bouncing “Serving” animation  
2. **Projects** — White section with circular project images, names, and “About this project” ghost buttons  
3. **About** — Dark gray section with a short studio description  
4. **Contact** — Footer with email and phone

## Setup

Open `index.html` in a browser, or serve the folder with any static server:

```bash
# Python
python -m http.server 8000

# Node (npx)
npx serve .
```

## Structure

- `index.html` — Page structure  
- `styles.css` — Layout and styles  
- `script.js` — Hero DVD bounce animation  

## Customization

- Replace project images and names in `index.html`  
- Update About copy in the `#about` section  
- Update email and phone in the `#contact` footer  
