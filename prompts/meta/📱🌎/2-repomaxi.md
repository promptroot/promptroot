an analysis suggested

Refactor Roadmap (High → Low Priority)
1. Finish Cleaning the Data Layer
2. Introduce Global Navigation Architecture
3. Expand ViewModel and Use Layers
4. Complete Dependency Injection Cleanup
5. Consolidate Sync and Upload Workflow
6. Migrate UI Incrementally to Compose
7. Optimize Remaining Performance Hotspots
8. Improve Code Health and Add Tests

based on that tell me all the spots with tasks we should do to accomplish above suggestion
remember we can only review 9.99ish pr s a round/day
give me 10 tasks
Mostly we wanna avoid merge conflicts during this PR review merge round
also this time focus specially on
reinforcing repository boundaries between layers
call out cross-feature data leaks and tighten repository interfaces
look also to find data functions to move one by one from UI/data/service into repositories

consider though
di
data layers
diffutil / listadapter (also use our DiffUtils.itemCallback)
viewmodels
threading / dispatchers usage
long running observers or listeners

we want low hanging fruits
no complicated stuff with many changes
so it is easily reviewable
also do not add unused code
keep it granular if possible

do not work on coding
focus on this report of 10 tasks

output format markdown:
split tasks with
markdown string for new section ---

ps there is no code output
we want an easy copyable plan
composed of at least 10 tasks
output into a markdown file
and/or in an easy copyable way
