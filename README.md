# Mastodon prioritized timeline

Super-naive Mastodon real-time timeline reordering (against user-defined parameters) using RxJs.
It will subscribe to your local and public feeds, buffer over specified time period, reorder against priorities and dump in time intervals specified.
This is to support my conviction that purely chronological timeline is a design choice (a bad one btw), not a technical limitation. However, the disability to fetch retroactively limits the potential of this aproach. 
