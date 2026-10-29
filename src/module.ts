import { createExtension } from "@cognigy/extension-tools";

import { agentApiConnection } from "./connections/agentApiConnection";

import { authSsoNode } from "./nodes/authSso";
import { authOtpStartNode } from "./nodes/authOtpStart";
import { authOtpVerifyNode } from "./nodes/authOtpVerify";
import { getUserNode } from "./nodes/getUser";
import { getAuditEventsNode } from "./nodes/getAuditEvents";
import { issueCouponNode } from "./nodes/issueCoupon";
import { selectCancellationSubscriptionNode } from "./nodes/selectCancellationSubscription";
import { cancelSubscriptionNode } from "./nodes/cancelSubscription";
import {
  liquidBarcodesOnErrorNode,
  liquidBarcodesOnSuccessNode,
} from './nodes/resultBranches';

export default createExtension({
  nodes: [
    authSsoNode,
    authOtpStartNode,
    authOtpVerifyNode,
    getUserNode,
    getAuditEventsNode,
    selectCancellationSubscriptionNode,
    cancelSubscriptionNode,
    issueCouponNode,
    liquidBarcodesOnSuccessNode,
    liquidBarcodesOnErrorNode,
  ],
  connections: [agentApiConnection],
  options: { label: "Liquid Barcodes Agent" },
});
