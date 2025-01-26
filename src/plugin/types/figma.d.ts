declare global {
  namespace NodeJS {
    interface Global {
      figma: {
        viewport: {
          zoom: number;
        };
        root: {
          type: string;
          children: any[];
        };
        currentPage: {
          selection: any[];
        };
        notify: (message: string) => void;
        ui: {
          postMessage: (msg: any) => void;
        };
      };
    }
  }
}

export {};
