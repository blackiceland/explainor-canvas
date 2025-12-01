export type SlotName = 'left' | 'center' | 'right';

export interface Position {
    readonly x: number;
    readonly y: number;
}

export interface StageConfig {
    width?: number;
    height?: number;
    padding?: number;
    columnGap?: number;
}

export class Stage {
    private readonly width: number;
    private readonly height: number;
    private readonly padding: number;
    private readonly columnGap: number;

    constructor(config: StageConfig = {}) {
        this.width = config.width ?? 1920;
        this.height = config.height ?? 1080;
        this.padding = config.padding ?? 100;
        this.columnGap = config.columnGap ?? 40;
    }

    public slot(name: SlotName): Position {
        switch (name) {
            case 'left':
                return {x: -this.width / 4 - this.columnGap / 2, y: 0};
            case 'right':
                return {x: this.width / 4 + this.columnGap / 2, y: 0};
            case 'center':
                return {x: 0, y: 0};
        }
    }

    public left(): Position {
        return this.slot('left');
    }

    public right(): Position {
        return this.slot('right');
    }

    public center(): Position {
        return this.slot('center');
    }

    public offset(base: Position, dx: number, dy: number): Position {
        return {x: base.x + dx, y: base.y + dy};
    }

    public get viewWidth(): number {
        return this.width;
    }

    public get viewHeight(): number {
        return this.height;
    }

    public get usableWidth(): number {
        return this.width - this.padding * 2;
    }

    public get columnWidth(): number {
        return (this.usableWidth - this.columnGap) / 2;
    }
}
