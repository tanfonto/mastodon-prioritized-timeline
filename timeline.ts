import {
  bufferTime,
  filter,
  interval,
  mergeWith,
  Observable,
  scan,
  Subject,
  switchMap,
  withLatestFrom,
} from "rxjs";
import { map, startWith } from "rxjs/operators";
import { make, take, Batch, Ticket, PriorityQueue } from "./priority-queue";
import { api, channel, FediverseEvent, Options, Trend } from "./fediverse";
import { ranking, TrendsMap, Weights } from "./ranking";

type FediverseTicket = Ticket<FediverseEvent>;

type Stream = Readonly<{
  data: readonly FediverseTicket[];
  size?: number;
}>;

type AccountTicketMap = Readonly<Record<number, FediverseTicket>>;

const config = {
  page: 50,
  top: 5,
  tick: 5000,
};

const channelOptions: Options = {
  host: "[Mastodon instance]",
  api: "v1/streaming",
  token: "[Authentication token]",
};

const apiOptions: Options = {
  ...channelOptions,
  api: "trends",
};

const weights: Weights = {
  botPenalty: 0.3,
  sensitivePenalty: 0.2,
  languagePenalty: 0.3,
  reply: 0.3,
  reblog: 0.9,
  favourite: 0.8,
  follower: 0.3,
  follows: 0.1,
  status: 0.02,
  isVerified: 1.1,
  isTrendy: 1.5,
  isReblog: 1.1,
};
const limits = [3000, 500, 100];
const languages = ["en", "pl"];
const ranked = ranking(weights, limits, languages);

const match = (event: FediverseEvent, trends: TrendsMap): FediverseTicket => {
  switch (event.source) {
    case "user":
      return { value: event, priority: 1 };
    case "public:local":
      return { value: event, priority: 2 };
    case "public:remote": {
      const rank = ranked(event, trends);
      if (!Number.isNaN(rank)) return { value: event, priority: 3 + rank };
    }
    default:
      return { value: event, priority: 4 + limits.length };
  }
};

const channel$ = channel(channelOptions);
const user$ = channel$("user");
const local$ = channel$("public:local");
const public$ = channel$("public:remote");

const trendsApi = () => api(apiOptions);

const makeTrends$ = (init: readonly Trend[], ms: number) =>
  interval(ms).pipe(
    startWith(init),
    switchMap(trendsApi),
    map((trends) =>
      trends.reduce(
        (acc, { name }) => ({ ...acc, [name.toLowerCase()]: true }),
        {}
      )
    )
  );

const unique = (tickets: readonly FediverseTicket[]) =>
  Object.values(
    tickets.reduce<AccountTicketMap>((acc, ticket) => {
      const { id } = ticket.value.account;
      const current = acc[id];
      return current == null
        ? { ...acc, [id]: ticket }
        : {
            ...acc,
            [id]: ticket.value.id > current.value.id ? ticket : acc[id],
          };
    }, {})
  );

const makeStream$ = (trendsTick = 60 * 60 * 1000): Observable<Stream> =>
  user$.pipe(
    mergeWith(local$, public$),
    withLatestFrom(
      trendsApi().pipe(switchMap((init) => makeTrends$(init, trendsTick)))
    ),
    map((sources) => match(...sources)),
    filter((ticket) => ticket.priority <= config.top),
    bufferTime(config.tick),
    map((tickets) => ({
      data: unique(tickets),
    }))
  );

const makeTimeline$ = (
  init: readonly FediverseTicket[],
  more$: Observable<Stream>
) =>
  makeStream$().pipe(
    mergeWith(more$),
    scan<Stream, Batch<FediverseEvent>>(
      ({ queue }, { data, size = 1 }) =>
        take(data.reduce(({ enqueued }, ticket) => enqueued(ticket), queue), size),
      { free: [], queue: make(init) }
    ),
    filter(({ free }) => free.length > 0),
    map(({ free }) => free)
  );

const more$ = new Subject<Stream>();
const more = (data: readonly FediverseTicket[]) =>
  more$.next({ data, size: config.page });

const timeline$ = makeTimeline$([], more$);

timeline$.subscribe((x) => {
  console.log(x);
});
