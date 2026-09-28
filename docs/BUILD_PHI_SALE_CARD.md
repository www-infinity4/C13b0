# Build Phi sale card

## Source

- Reusable orange presentation: `src/components/build-phi/SaleCard.tsx`
- Mercury dime test checkout and receipt inbox: `src/components/MercuryDimeTestSale.tsx`
- Build Phi example: `src/app/phi/build/cards/page.tsx`
- Infinity Phi placement: `src/components/PhiIntentShell.tsx`
- Live entry: `https://www-infinity4.github.io/C13b0/phi/build/cards/`

This template can be moved into the separate Build Phi repository once that repository exists. Keep the presentation component reusable; do not copy the test checkout as a real purchase implementation.

## Props and composition

`SaleCard` accepts `listing` and `onBuy`. Listing fields: title, priceLabel, imageUrl, imageAlt, description, optional badge and testOnly. It owns the orange layout, responsive image panel, price, and Buy now button. The host owns routing, inventory, wallet authorization, purchase state, and receipts.

The Mercury demo passes `1936-D Mercury dime`, `100 Quants`, a Wikimedia Commons stock image, a clear test badge, and an `onBuy` callback. It moves between listing, checkout, and test-purchased views. The receipt inbox lives in localStorage on the current browser; the form discards street and postal address. The illustrative ship date is three days after the test. There is no actual seller or inventory and no real Quant debit.

## Real listing data

A production sale needs a seller account, verified inventory/item identity and condition, price in unique Quant serials plus StarCoin cents, fulfillment terms, shipping method, seller contact shown on receipts, policy version, listing ID, and image rights. A stock photo must remain labeled as representative. Buy now creates a quote; completing sale commits a NEC transfer before Purchased and receipts appear.

Use the atomic transfer, receipt, consent, and scanner contract in `www-infinity4/NEC/QUANT_TRANSFER_CONTRACT.md`. Receipts belong in a server-side inbox keyed to wallet identity, accessible across devices, not browser localStorage. Do not attach buyer shipping details to a transferable Quant or ad-scanner response.

## Template acceptance

- Card stays readable on a narrow Android viewport with image above copy.
- Buy now opens shipping checkout; back preserves the listing.
- Failed transfer never shows Purchased.
- Successful NEC commit produces one buyer receipt and one seller order notification under the same transaction ID.
- Ship-by is a seller estimate until a shipping update exists.
- The same component accepts a different item without editing its styling.
