from typing import Mapping, MutableMapping, Optional

from rest_framework.request import Request

from sentry.integrations.slack.requests.base import SlackRequest, SlackRequestError
from sentry.models import Group
from sentry.utils import json
from sentry.utils.cache import memoize
from sentry.utils.json import JSONData


class SlackActionRequest(SlackRequest):
    """
    An Action request sent from Slack.

    Action requests nest their data inside of a ``payload`` key in the request
    body, for some reason. Therefore they require an extra bit of data
    validation.
    """

    def __init__(self, request: Request) -> None:
        super().__init__(request)
        self._callback_data = None

    @property
    def type(self) -> str:
        return str(self.data.get("type"))

    @memoize  # type: ignore
    def callback_data(self) -> JSONData:
        """
        We store certain data in ``callback_id`` as JSON. It's a bit hacky, but
        it's the simplest way to store state without saving it on the Sentry
        side.

        Data included in this field:
            - issue: the ID of the corresponding Issue
            - orig_response_url: URL from the original message we received
            - is_message: did the original message have a 'message' type
        """
        return json.loads(self.data.get("callback_id"))

    def _validate_data(self) -> None:
        """
        Action requests provide the body of the request differently than Event
        requests (nested in a ``payload`` attribute), so there's extra
        validation needed.
        """
        super()._validate_data()

        if "payload" not in self.request.data:
            raise SlackRequestError(status=400)

        try:
            self._data = json.loads(self.data["payload"])
        except (KeyError, IndexError, TypeError, ValueError):
            raise SlackRequestError(status=400)

    def _log_request(self) -> None:
        self._info("slack.action")

    def get_logging_data(
        self,
        group: Optional[Group] = None,
    ) -> Mapping[str, Optional[str]]:
        logging_data: MutableMapping[str, Optional[str]] = {
            **self.logging_data,
            "response_url": self.response_url,
        }

        if group:
            logging_data.update(
                {
                    "group_id": group.id,
                    "organization_id": group.organization.id,
                }
            )

        return logging_data
