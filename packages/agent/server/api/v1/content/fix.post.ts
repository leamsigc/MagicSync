import { runContentApi } from '../../../utils/content-api-route'

export default defineEventHandler(event => runContentApi(event, 'content.fix'))