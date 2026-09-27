<div align="center">

# Nabdh

### The pulse of Tunisian tech, personalized.

Nabdh brings Tunisian technology news, jobs, internships, and events into one feed, ranked around each user's interests.

![Status](https://img.shields.io/badge/status-prototype-orange)

</div>

## About

Tech opportunities in Tunisia are spread across job boards, social networks, community groups, and event pages. Nabdh is designed to make that information easier to discover by combining local content with lightweight, profile-based personalization.

Users choose their occupation and interests, then receive a feed containing:

- Technology news
- Jobs and internships
- Technology events

Each item includes a short explanation of why it was recommended. Feedback can be used to improve future rankings, while automatic refresh keeps the feed current.

## Product flow

1. Create a profile with an occupation and interest tags.
2. Collect Tunisia-focused content from supported search sources.
3. Rank items according to the user's profile and recent feedback.
4. Display the feed with a relevance explanation for every item.
5. Refresh the feed automatically at the configured interval.

## Architecture

```text
/frontend
  index.html          Profile setup and feed UI
  styles.css           Application styles
  app.js               Client state and API calls
  seed_items.json      Local fallback content

/backend
  server.js            Application server
  routes/search.js     Search integration and fallback handling
  routes/rank.js       Ranking endpoint
  ai_client.js         Server-side model integration
```

The search layer can fall back to local seed data when an external source is unavailable. The ranking layer also has a deterministic fallback so the feed can remain usable when an AI provider is unavailable or returns invalid data.

## AI and personalization

The ranking service receives a user profile and a set of content items, then returns an ordered list with a concise reason for each result. Feedback can adjust the importance of interest tags over time.

API keys belong on the server and should be provided through environment variables. Never commit `.env` files or credentials to the repository.

## Project status

Nabdh is an early prototype. The current direction focuses on the core personalized feed experience. Future work includes production source integrations, richer feedback signals, scheduled backend refreshes, and broader regional coverage.

## Contributing

Issues and pull requests are welcome. For larger changes, please open an issue first to discuss the proposed direction.
