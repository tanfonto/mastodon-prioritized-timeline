export type Ticket<A> = Readonly<{ value: A; priority: number }>;
export type Tickets<A> = readonly Ticket<A>[];
export type Dequeued<A> = Readonly<{
  free: A;
  queue: PriorityQueue<A>;
}>;
export type PriorityQueue<A> = Readonly<{
  enqueued: (ticket: Ticket<A>) => PriorityQueue<A>;
  dequeued: () => Dequeued<A>;
}>;

const enqueue = <A>(
  ticket: Ticket<A>,
  left: Tickets<A>,
  [current, ...right]: Tickets<A>
): Tickets<A> =>
  ticket.priority > current.priority
    ? [...left, current, ticket, ...right]
    : enqueue(ticket, [...left, current], right);

export type Batch<A> = Readonly<{ free: readonly A[]; queue: PriorityQueue<A> }>;
export function take<A>(
  { dequeued }: PriorityQueue<A>,
  n: number,
  acc: readonly A[] = []
): Batch<A> {
  const { free, queue } = dequeued();
  if (n > 0) {
    return take(queue, n - 1, [...acc, free]);
  }
  return { free: acc, queue };
}

// TODO: optimize
export const make = <A>(
  items: readonly Ticket<A>[],
  limit = 500
): PriorityQueue<A> => ({
  enqueued(ticket) {
    const result = enqueue(ticket, [], items);
    return make(result.length > limit ? result.slice(0, limit) : result);
  },
  dequeued() {
    const [ticket, ...tail] = items;
    return {
      free: ticket.value,
      queue: make(tail),
    };
  },
});
