---
title: "Google Ads conversion tracking, start to finish"
description: "These are my notes/recordings from setting up a new Google Ads account, recorded step by step as I worked through it, then organized with Claude into something a marketer could follow."
publishDate: 2026-09-03
tags: ["Lab Notes", "Google Ads", "Conversion Tracking", "GTM"]
ogImage: "https://jjcruzgalera.com/guides/conversion-tracking-cover.png"
---

Google Ads conversion tracking records a conversion each time someone completes a meaningful action on your site, such as submitting a contact form, so you can see which keywords and ads produced real leads and give Smart Bidding something to optimize toward. This manual walks through the full setup in order, using Google Tag Manager, from choosing the action worth counting to verifying the signal actually arrives in Google Ads.

Chapters 2 through 6 are the required path. Chapter 7 is optional. Hands-on time is roughly 1.5 to 2 hours. Then there will be two waiting periods: a few hours before your first test conversion shows up in reporting, and two to four weeks before you have enough volume to make decisions from.

## How do you set up Google Ads conversion tracking?

**0. Before you begin.** Scope, prerequisites, and the two paths through the manual.

**1. How the system works.** The three environments you move between, your website, Google Tag Manager, and Google Ads, plus the five moving parts: data layer, trigger, variable, tag, conversion action.

**2. Decide what counts, and check what exists.** Pick the action worth counting, confirm the GTM container is live, verify your GA4 Measurement ID, settle whether you need consent mode.

**3. Make your website report the action.** Get a data layer event firing on a successful submission. Verify what you can verify without a developer. If you have developer support, use it as much as possible.

**4. Create the conversion action in Google Ads.** Data source, category, count setting, primary or secondary, value, conversion window, then copy the Conversion ID and Label. Recommend saving the IDs and labels and other indicators in a separate notepad.

**5. Wire it up in Google Tag Manager.** Build the trigger, the Conversion Linker tag, and the conversion tag.

**6. Publish and verify.** Publish the container, test the whole chain end-to-end. Tracking is live at this point.

**7. Add enhanced conversions.** Optional/recommended. Read the email, hash it, confirm it resolves, attach it to the conversion tag, republish.

What if Google Ads shows zero conversions? Appendix A is organized by symptom rather than by cause, because one symptom has many possible causes and the platform gives you no error message either way. It covers zero conversions, counts that look too high, low enhanced conversions match rates, tags that worked in Preview but not in production, and Google Ads, GA4, and your CRM all disagreeing. A glossary in chapter order and sources for every claim follow it.

[![Google Ads conversion tracking, start to finish](/guides/conversion-tracking-cover.png)](/guides/conversion-tracking)

[Google Ads conversion tracking, start to finish](/guides/conversion-tracking)
