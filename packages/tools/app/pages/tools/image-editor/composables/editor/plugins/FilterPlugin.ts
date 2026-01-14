import { Canvas, FabricImage, filters } from 'fabric';
import { BaseFabricPlugin, FabricEditor } from '../FabricEditor';

export class FilterPlugin extends BaseFabricPlugin {
    static readonly pluginName = 'filter';
    override readonly pluginName = 'filter';

    override readonly exposedMethods = [
        'applyImageAdjustment',
        'applyPresetFilter'
    ];

    protected init() { }

    applyImageAdjustment(
        filterType:
            | 'Brightness'
            | 'Contrast'
            | 'Saturation'
            | 'Hue'
            | 'Blur'
            | 'Sharpen'
            | 'Invert',
        value: number,
    ) {
        if (this.canvas) {
            const activeObject = this.canvas.getActiveObject();
            if (activeObject?.type === 'image') {
                const img = activeObject as FabricImage;
                let filter: filters.BaseFilter<any> | undefined;

                switch (filterType) {
                    case 'Brightness':
                        filter = new filters.Brightness({ brightness: value });
                        break;
                    case 'Contrast':
                        filter = new filters.Contrast({ contrast: value });
                        break;
                    case 'Saturation':
                        filter = new filters.Saturation({ saturation: value });
                        break;
                    case 'Hue':
                        filter = new filters.HueRotation({ rotation: value });
                        break;
                    case 'Blur':
                        filter = new filters.Blur({ blur: value });
                        break;
                    case 'Invert':
                        filter = new filters.Invert();
                        break;
                }

                if (filter) {
                    img.filters = img.filters.filter(
                        (f) => !(f instanceof (filter as any).constructor),
                    );
                    img.filters.push(filter);
                    img.applyFilters();
                    this.canvas.requestRenderAll();
                }
            }
        }
    }

    applyPresetFilter(preset: string) {
        if (this.canvas) {
            const activeObject = this.canvas.getActiveObject();
            if (activeObject?.type === 'image') {
                const img = activeObject as FabricImage;
                img.filters = [];
                switch (preset) {
                    case 'Original':
                        break;
                    case 'Grayscale':
                        img.filters.push(new filters.Grayscale());
                        break;
                    case 'Sepia':
                        img.filters.push(new filters.Sepia());
                        break;
                    case 'Contrast':
                        img.filters.push(new filters.Contrast({ contrast: 0.5 }));
                        break;
                    case 'Brightness':
                        img.filters.push(new filters.Brightness({ brightness: 0.2 }));
                        break;
                    case 'Negative':
                        img.filters.push(new filters.Invert());
                        break;
                    case 'dramatic':
                        img.filters.push(new filters.Contrast({ contrast: 0.3 }));
                        img.filters.push(new filters.Saturation({ saturation: 0.2 }));
                        break;
                    case 'nature':
                        img.filters.push(new filters.HueRotation({ rotation: 0.1 }));
                        img.filters.push(new filters.Saturation({ saturation: 0.15 }));
                        break;
                }
                img.applyFilters();
                this.canvas.requestRenderAll();
            }
        }
    }
}
