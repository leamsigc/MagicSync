import { defaultTemplateConfig, defaultCodeHtml, defaultCodeCss, defaultLayers, type OgDoc } from './og-model'

const defaultDoc = (): OgDoc => ({
  platform: 'og',
  templateConfig: defaultTemplateConfig(),
  codeHtml: defaultCodeHtml(),
  codeCss: defaultCodeCss(),
  layers: defaultLayers()
})

export function useOgDoc() {
  return useState<OgDoc>('og-image-generator:doc', defaultDoc)
}
