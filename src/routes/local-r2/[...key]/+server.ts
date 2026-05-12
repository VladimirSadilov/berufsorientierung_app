import { error, type RequestHandler } from '@sveltejs/kit';
import { dev } from '$app/environment';

export const GET: RequestHandler = async ({ params, platform }) => {
	if (!dev) {
		throw error(404, 'Not found');
	}

	const key = params.key;
	if (!key) {
		throw error(404, 'Not found');
	}

	const bucket = platform?.env?.R2_BUCKET;
	if (!bucket) {
		throw error(500, 'R2_BUCKET is not available');
	}

	const object = await bucket.get(key);
	if (!object) {
		throw error(404, 'Not found');
	}

	const headers = new Headers();
	if (object.httpMetadata?.contentType) {
		headers.set('content-type', object.httpMetadata.contentType);
	}

	if (object.httpMetadata?.contentLanguage) {
		headers.set('content-language', object.httpMetadata.contentLanguage);
	}

	if (object.httpMetadata?.contentDisposition) {
		headers.set('content-disposition', object.httpMetadata.contentDisposition);
	}

	if (object.httpMetadata?.contentEncoding) {
		headers.set('content-encoding', object.httpMetadata.contentEncoding);
	}

	if (object.httpMetadata?.cacheControl) {
		headers.set('cache-control', object.httpMetadata.cacheControl);
	}

	headers.set('etag', object.httpEtag);
	headers.set('cache-control', 'no-store');

	if (!headers.has('content-type')) {
		headers.set('content-type', 'application/octet-stream');
	}

	return new Response(await object.arrayBuffer(), { headers });
};
