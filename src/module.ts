import { createExtension } from "@cognigy/extension-tools";

import { agentApiConnection } from "./connections/agentApiConnection";

import { authOtpStartNode } from "./nodes/authOtpStart";
import { authOtpVerifyNode } from "./nodes/authOtpVerify";
import { getUserNode } from "./nodes/getUser";
import { selectCancellationSubscriptionNode } from "./nodes/selectCancellationSubscription";
import { cancelSubscriptionNode } from "./nodes/cancelSubscription";
import {
  liquidBarcodesOnErrorNode,
  liquidBarcodesOnSuccessNode,
} from './nodes/resultBranches';

export default createExtension({
  nodes: [
    authOtpStartNode,
    authOtpVerifyNode,
    getUserNode,
    selectCancellationSubscriptionNode,
    cancelSubscriptionNode,
    liquidBarcodesOnSuccessNode,
    liquidBarcodesOnErrorNode,
  ],
  connections: [agentApiConnection],
  options: { label: "Liquid Barcodes Agent" },
});
