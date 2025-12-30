import {Node, Rect} from '@motion-canvas/2d';
import {createRef, Reference} from '@motion-canvas/core';
import {Colors} from '../../theme';
import {PanelStyle} from '../../panelStyle';

export interface CodeCardStyle {
    radius?: number;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    opacity?: number;
    shadowColor?: string;
    shadowBlur?: number;
    shadowOffsetX?: number;
    shadowOffsetY?: number;
}

export interface CodeCardConfig {
    width: number;
    height: number;
    style?: CodeCardStyle;
}

const DEFAULT_STYLE: Required<CodeCardStyle> = {
    radius: PanelStyle.radius,
    fill: Colors.surface,
    stroke: PanelStyle.stroke,
    strokeWidth: PanelStyle.lineWidth,
    opacity: 1,
    shadowColor: PanelStyle.shadowColor,
    shadowBlur: PanelStyle.shadowBlur,
    shadowOffsetX: PanelStyle.shadowOffset[0],
    shadowOffsetY: PanelStyle.shadowOffset[1],
};

export class CodeCard {
    private readonly rectRef: Reference<Rect> = createRef<Rect>();
    private readonly config: CodeCardConfig;
    private readonly style: Required<CodeCardStyle>;

    constructor(config: CodeCardConfig) {
        this.config = config;
        this.style = {...DEFAULT_STYLE, ...config.style};
    }

    public build(): Rect {
        const rect = new Rect({
            width: this.config.width,
            height: this.config.height,
            radius: this.style.radius,
            fill: this.style.fill,
            stroke: this.style.stroke,
            lineWidth: this.style.strokeWidth,
            opacity: this.style.opacity,
            shadowColor: this.style.shadowColor,
            shadowBlur: this.style.shadowBlur,
            shadowOffset: [this.style.shadowOffsetX, this.style.shadowOffsetY],
        });
        this.rectRef(rect);
        return rect;
    }

    public get node(): Rect {
        return this.rectRef();
    }

    public get width(): number {
        return this.config.width;
    }

    public get height(): number {
        return this.config.height;
    }
}



