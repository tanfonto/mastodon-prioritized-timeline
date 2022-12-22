import { webSocket } from "rxjs/webSocket";
import { map } from "rxjs/operators";
import { filter } from "rxjs";
import { ajax } from "rxjs/internal/ajax/ajax";

export type Channel = "user" | "public:local" | "public:remote";

export type EventType = "delete" | "update";

export type Tag = Readonly<{ name: string; url: string }>;

export type Field = Readonly<{
  name: string;
  value: string;
  verified_at: string | null;
}>;

export type Message = Readonly<{ payload: string; event: string }>;

export type Trend = Readonly<{
  name: string;
  url: string;
}>;

export type Account = Readonly<{
  id: number;
  followers_count: number;
  following_count: number;
  statuses_count: number;
  bot: boolean;
  fields: readonly Field[];
}>;

export type Publish = Readonly<{
  id: number;
  reblogs_count: number;
  favourites_count: number;
  replies_count: number;
  account: Account;
  sensitive: boolean;
  reblog: number | null;
  tags: readonly Tag[];
  language: string;
}>;

// TODO: discriminated union
export type FediverseEvent = Readonly<{
  source: Channel;
  event: EventType;
}> &
  Publish;

export type Options = Readonly<{
  host: string;
  api: string;
  token: string;
}>;

export const channel =
  ({ host, api, token }: Options) =>
  (source: Channel) =>
    webSocket<Message>({
      url: `wss://${host}/api/${api}/?stream=${source}`,
      protocol: [token],
    }).pipe(
      filter(({ event }) => event === "update"),
      map<Message, FediverseEvent>(({ payload, event }) => ({
        source,
        event,
        ...JSON.parse(payload),
      }))
    );

export const api = ({ host, api, token }: Options) =>
  ajax
    .get<Readonly<Trend>[]>(`https://${host}/api/v1/${api}/tags`, {
      Authorization: `Bearer ${token}`,
    })
    .pipe(map(({ response }) => response));
