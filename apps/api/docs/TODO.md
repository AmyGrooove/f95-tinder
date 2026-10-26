# Tag dictionary follow-up

- [ ] Choose and approve catalogue sources for video and games in a separate chat; Kodik and IGDB are candidates, not an approved source selection
- [ ] Inspect available source values for every controlled dictionary group and prepare an initial dictionary for approval
- [ ] Resolve synonyms, aliases, ambiguous meanings and parent/subgenre relations before creating canonical tags
- [ ] Define keys for remaining dictionary concepts and Russian/English names, then populate approved Tag records; fixed/range keys are already defined in TAG_GROUP_RULES
- [ ] Define how import marks unknown values for review and resumes after approval; unknown values must not automatically create tags
- [ ] Approve ESRB/PEGI conversion into 0+, 6+, 12+, 16+, 18+ and precedence when sources disagree; preserve source classifications and do not guess unknown mappings
- [ ] Implement synchronization of derived tags with Item fields, including date/year consistency and removal of outdated range tags
- [x] Replace production Feature/ItemFeature consumers with Item fields and tags, expose exact field filters, remove featurePreferences and obsolete production slices; no migration because no data exists

Agreed group rules: [TAG_GROUP_RULES.ts](../src/entities/tag/static/TAG_GROUP_RULES.ts)
