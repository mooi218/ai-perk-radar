# Privacy Policy for AI Perk Radar

Last updated: September 11, 2026

AI Perk Radar helps users discover student, developer, AI, research, and free-tier opportunities that may match their selected profile and interests.

## Information used by the app

AI Perk Radar processes the choices you make in the app, such as country/region, role, interests, priority, and whether you want to see only time-limited offers. These inputs are used to rank and present matching opportunities.

The app may use Anna platform capabilities, including tool invocation, app storage, and language-model completion, in order to provide its features. Data handled by the Anna platform is also subject to Anna's own terms and privacy practices.

The v0.1.7 draft remembers your profile and language, saved perk IDs/titles and save times, and a previous-visit snapshot containing the visit time, matched IDs, and hashes of catalog facts. These values are stored in Anna's per-user App bucket. They support restoration and new/changed indicators; they are not used as an offline source of current offer terms. You can remove a saved perk using its Save toggle.

In v0.1.7, a language-model explanation is requested only when you click the Anna explanation button. It receives the profile used for matching and the single selected perk, and uses the Anna account's available model and quota. Saved lists and visit history are not sent to the model.

## Data collection and sharing

AI Perk Radar does not independently sell personal information to advertisers or data brokers.

The app does not require users to create a separate AI Perk Radar account. It is not designed to collect sensitive personal information such as passwords, payment-card numbers, government identifiers, or precise location data.

## Third-party links

From v0.1.6, each perk search downloads the current public catalog from GitHub's `raw.githubusercontent.com` service. This request contains no selected profile, Anna token, API key, cookie, or persistent user identifier. GitHub receives normal network request information, such as IP address and browser information, and a time-only cache parameter. GitHub's privacy practices apply to this delivery. The catalog is not stored persistently by AI Perk Radar; if it cannot be fetched and validated, the app asks you to retry.

Your profile and the selected recommendation are still processed through the Anna tool, storage, and language-model capabilities described above. The catalog download does not send your profile to individual offer providers.

AI Perk Radar links to official websites and third-party services for offers, programs, and free tiers. When you open those links, the privacy practices and terms of those third parties apply.

## Data accuracy

Offer availability, eligibility requirements, value, and deadlines can change. AI Perk Radar aims to link to official sources so users can verify current details before applying or purchasing.

## Changes to this policy

This policy may be updated if the app's functionality or data practices change. The latest version will be published in this repository.

## Contact

For questions or support related to AI Perk Radar, please use the project's GitHub repository:

https://github.com/mooi218/ai-perk-radar
