export {};

declare global {
  interface ObjectConstructor {
    freeze<T extends {
      default: number;
      title: number;
      header: number;
      subheader: number;
      text: number;
      date: number;
      integer: number;
      percent: number;
      taskBar: number;
      summaryBar: number;
      weekend: number;
      holiday: number;
      milestone: number;
      muted: number;
    }>(value: T): Readonly<{ [K in keyof T]: number }>;
  }
}
