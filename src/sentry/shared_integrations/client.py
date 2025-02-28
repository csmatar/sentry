import logging
from collections import OrderedDict

import requests
import sentry_sdk
from bs4 import BeautifulSoup
from django.core.cache import cache
from django.utils.functional import cached_property
from requests.exceptions import ConnectionError, HTTPError, Timeout

from sentry.api.client import ApiClient
from sentry.http import build_session
from sentry.utils import json, metrics
from sentry.utils.decorators import classproperty
from sentry.utils.hashlib import md5_text

from .exceptions import ApiError, ApiHostError, ApiTimeoutError, UnsupportedResponseType


class BaseApiResponse:
    text = ""

    def __init__(self, headers=None, status_code=None):
        self.headers = headers
        self.status_code = status_code

    def __repr__(self):
        return "<{}: code={}, content_type={}>".format(
            type(self).__name__,
            self.status_code,
            self.headers.get("Content-Type", "") if self.headers else "",
        )

    @cached_property
    def rel(self):
        if not self.headers:
            return {}
        link_header = self.headers.get("Link")
        if not link_header:
            return {}
        return {item["rel"]: item["url"] for item in requests.utils.parse_header_links(link_header)}

    @classmethod
    def from_response(self, response, allow_text=False):
        if response.request.method == "HEAD":
            return BaseApiResponse(response.headers, response.status_code)
        # XXX(dcramer): this doesnt handle leading spaces, but they're not common
        # paths so its ok
        if response.text.startswith("<?xml"):
            return XmlApiResponse(response.text, response.headers, response.status_code)
        elif response.text.startswith("<"):
            if not allow_text:
                raise ValueError(f"Not a valid response type: {response.text[:128]}")
            elif response.status_code < 200 or response.status_code >= 300:
                raise ValueError(
                    f"Received unexpected plaintext response for code {response.status_code}"
                )
            return TextApiResponse(response.text, response.headers, response.status_code)

        # Some APIs will return JSON with an invalid content-type, so we try
        # to decode it anyways
        if "application/json" not in response.headers.get("Content-Type", ""):
            try:
                data = json.loads(response.text, object_pairs_hook=OrderedDict)
            except (TypeError, ValueError):
                if allow_text:
                    return TextApiResponse(response.text, response.headers, response.status_code)
                raise UnsupportedResponseType(
                    response.headers.get("Content-Type", ""), response.status_code
                )
        else:
            data = json.loads(response.text, object_pairs_hook=OrderedDict)

        if isinstance(data, dict):
            return MappingApiResponse(data, response.headers, response.status_code)
        elif isinstance(data, (list, tuple)):
            return SequenceApiResponse(data, response.headers, response.status_code)
        else:
            raise NotImplementedError


class TextApiResponse(BaseApiResponse):
    def __init__(self, text, *args, **kwargs):
        self.text = text
        super().__init__(*args, **kwargs)


class XmlApiResponse(BaseApiResponse):
    def __init__(self, text, *args, **kwargs):
        self.xml = BeautifulSoup(text, "xml")
        super().__init__(*args, **kwargs)


class MappingApiResponse(dict, BaseApiResponse):
    def __init__(self, data, *args, **kwargs):
        dict.__init__(self, data)
        BaseApiResponse.__init__(self, *args, **kwargs)

    @property
    def json(self):
        return self


class SequenceApiResponse(list, BaseApiResponse):
    def __init__(self, data, *args, **kwargs):
        list.__init__(self, data)
        BaseApiResponse.__init__(self, *args, **kwargs)

    @property
    def json(self):
        return self


class TrackResponseMixin:
    @cached_property
    def logger(self):
        return logging.getLogger(self.log_path)

    @classproperty
    def name_field(cls):
        return "%s_name" % cls.integration_type

    @classproperty
    def name(cls):
        return getattr(cls, cls.name_field)

    def track_response_data(self, code, span, error=None, resp=None):
        metrics.incr(
            "%s.http_response" % (self.datadog_prefix),
            sample_rate=1.0,
            tags={self.integration_type: self.name, "status": code},
        )

        try:
            span.set_http_status(int(code))
        except ValueError:
            span.set_status(code)

        span.set_tag(self.integration_type, self.name)

        extra = {
            self.integration_type: self.name,
            "status_string": str(code),
            "error": str(error)[:256] if error else None,
        }
        extra.update(getattr(self, "logging_context", None) or {})
        self.logger.info("%s.http_response" % (self.integration_type), extra=extra)


class BaseApiClient(TrackResponseMixin):
    base_url = None

    allow_text = False

    allow_redirects = None

    integration_type = None

    log_path = None

    datadog_prefix = None

    cache_time = 900

    page_size = 100

    page_number_limit = 10

    def __init__(self, verify_ssl=True, logging_context=None):
        self.verify_ssl = verify_ssl
        self.logging_context = logging_context

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        # TODO(joshuarli): Look into reusing a SafeSession, and closing it here.
        #                  Don't want to make the change until I completely understand
        #                  urllib3 machinery + how we override it, possibly do this
        #                  along with urllib3 upgrade.
        pass

    def get_cache_prefix(self):
        return f"{self.integration_type}.{self.name}.client:"

    def build_url(self, path):
        if path.startswith("/"):
            if not self.base_url:
                raise ValueError(f"Invalid URL: {path}")
            return f"{self.base_url}{path}"
        return path

    def _request(
        self,
        method,
        path,
        headers=None,
        data=None,
        params=None,
        auth=None,
        json=True,
        allow_text=None,
        allow_redirects=None,
        timeout=None,
    ):

        if allow_text is None:
            allow_text = self.allow_text

        if allow_redirects is None:
            allow_redirects = self.allow_redirects

        if allow_redirects is None:  # is still None
            allow_redirects = method.upper() == "GET"

        if timeout is None:
            timeout = 30

        full_url = self.build_url(path)

        metrics.incr(
            f"{self.datadog_prefix}.http_request",
            sample_rate=1.0,
            tags={self.integration_type: self.name},
        )

        try:
            with sentry_sdk.configure_scope() as scope:
                parent_span_id = scope.span.span_id
                trace_id = scope.span.trace_id
        except AttributeError:
            parent_span_id = None
            trace_id = None

        with sentry_sdk.start_transaction(
            op=f"{self.integration_type}.http",
            name=f"{self.integration_type}.http_response.{self.name}",
            parent_span_id=parent_span_id,
            trace_id=trace_id,
            sampled=True,
        ) as span:
            try:
                with build_session() as session:
                    resp = getattr(session, method.lower())(
                        url=full_url,
                        headers=headers,
                        json=data if json else None,
                        data=data if not json else None,
                        params=params,
                        auth=auth,
                        verify=self.verify_ssl,
                        allow_redirects=allow_redirects,
                        timeout=timeout,
                    )
                    resp.raise_for_status()
            except ConnectionError as e:
                self.track_response_data("connection_error", span, e)
                raise ApiHostError.from_exception(e)
            except Timeout as e:
                self.track_response_data("timeout", span, e)
                raise ApiTimeoutError.from_exception(e)
            except HTTPError as e:
                resp = e.response
                if resp is None:
                    self.track_response_data("unknown", span, e)
                    self.logger.exception(
                        "request.error", extra={self.integration_type: self.name, "url": full_url}
                    )
                    raise ApiError("Internal Error", url=full_url)
                self.track_response_data(resp.status_code, span, e)
                raise ApiError.from_response(resp, url=full_url)

            self.track_response_data(resp.status_code, span, None, resp)

            if resp.status_code == 204:
                return {}

            return BaseApiResponse.from_response(resp, allow_text=allow_text)

    # subclasses should override ``request``
    def request(self, *args, **kwargs):
        return self._request(*args, **kwargs)

    def delete(self, *args, **kwargs):
        return self.request("DELETE", *args, **kwargs)

    def _get_cached(self, path: str, method: str, *args, **kwargs):
        query = ""
        if kwargs.get("params", None):
            query = json.dumps(kwargs.get("params"), sort_keys=True)
        key = self.get_cache_prefix() + md5_text(self.build_url(path), query).hexdigest()

        result = cache.get(key)
        if result is None:
            result = self.request(method, path, *args, **kwargs)
            cache.set(key, result, self.cache_time)
        return result

    def get_cached(self, path, *args, **kwargs):
        return self._get_cached(path, "GET", *args, **kwargs)

    def get(self, *args, **kwargs):
        return self.request("GET", *args, **kwargs)

    def patch(self, *args, **kwargs):
        return self.request("PATCH", *args, **kwargs)

    def post(self, *args, **kwargs):
        return self.request("POST", *args, **kwargs)

    def put(self, *args, **kwargs):
        return self.request("PUT", *args, **kwargs)

    def head(self, *args, **kwargs):
        return self.request("HEAD", *args, **kwargs)

    def head_cached(self, path, *args, **kwargs):
        return self._get_cached(path, "HEAD", *args, **kwargs)

    def get_with_pagination(self, path, gen_params, get_results, *args, **kwargs):
        page_size = self.page_size
        offset = 0
        output = []

        for i in range(self.page_number_limit):
            resp = self.get(path, params=gen_params(i, page_size))
            results = get_results(resp)
            num_results = len(results)

            output += results
            offset += num_results
            # if the number is lower than our page_size, we can quit
            if num_results < page_size:
                return output
        return output


class BaseInternalApiClient(ApiClient, TrackResponseMixin):
    integration_type = None

    log_path = None

    datadog_prefix = None

    def request(self, *args, **kwargs):

        metrics.incr(
            "%s.http_request" % self.datadog_prefix,
            sample_rate=1.0,
            tags={self.integration_type: self.name},
        )

        try:
            with sentry_sdk.configure_scope() as scope:
                parent_span_id = scope.span.span_id
                trace_id = scope.span.trace_id
        except AttributeError:
            parent_span_id = None
            trace_id = None

        with sentry_sdk.start_transaction(
            op=f"{self.integration_type}.http",
            name=f"{self.integration_type}.http_response.{self.name}",
            parent_span_id=parent_span_id,
            trace_id=trace_id,
            sampled=True,
        ) as span:
            resp = ApiClient.request(self, *args, **kwargs)
            self.track_response_data(resp.status_code, span, None, resp)
            return resp
