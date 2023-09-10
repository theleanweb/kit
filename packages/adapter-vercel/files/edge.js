import Router from "SERVER";
import adapt from "@hattip/adapter-vercel-edge";

export default adapt(Router.buildHandler());
