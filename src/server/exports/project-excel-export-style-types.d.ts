export {};

declare global {
  interface ObjectConstructor {
    freeze(value: {
      readonly default: 0;
      readonly title: 1;
      readonly header: 2;
      readonly subheader: 3;
      readonly text: 4;
      readonly date: 5;
      readonly integer: 6;
      readonly percent: 7;
      readonly taskBar: 8;
      readonly summaryBar: 9;
      readonly weekend: 10;
      readonly holiday: 11;
      readonly milestone: 12;
      readonly muted: 13;
    }): Readonly<{
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
    }>;
  }
}
