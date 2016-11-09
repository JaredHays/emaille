package com.jaredhays.emaille;

import java.io.IOException;
import java.io.PrintWriter;
import java.nio.channels.Channels;
import java.util.ArrayList;
import java.util.logging.Logger;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import com.google.appengine.tools.cloudstorage.GcsFilename;
import com.google.appengine.tools.cloudstorage.GcsInputChannel;
import com.google.appengine.tools.cloudstorage.GcsService;
import com.google.appengine.tools.cloudstorage.GcsServiceFactory;
import com.google.appengine.tools.cloudstorage.ListItem;
import com.google.appengine.tools.cloudstorage.ListOptions;
import com.google.appengine.tools.cloudstorage.ListResult;
import com.google.common.base.Charsets;
import com.google.common.collect.Lists;
import com.google.common.io.CharStreams;
import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

@SuppressWarnings("serial")
public class GetWeavesListServlet extends HttpServlet {
	static GcsService gcsService = GcsServiceFactory.createGcsService();
	final static String BUCKET_NAME = "e-maille.appspot.com";
	final static int BUFFER_SIZE = 2 * 1024 * 1024;

	static ArrayList<WeaveData> weaveList = Lists.newArrayList();

	private static void loadWeaveList() throws IOException {
		ListResult result = gcsService.list(BUCKET_NAME, new ListOptions.Builder().setPrefix("data/weave/").setRecursive(true).build());

		while (result.hasNext()) {
			ListItem item = result.next();

			GcsInputChannel input = gcsService.openPrefetchingReadChannel(new GcsFilename(BUCKET_NAME, item.getName()),
					0, BUFFER_SIZE);
			Logger.getLogger(item.getName() + ": " + GetWeavesListServlet.class.getName())
					.info(CharStreams.toString(Channels.newReader(input, Charsets.UTF_8.name())));
			try {
				JsonObject weave = new JsonParser().parse(Channels.newReader(input, Charsets.UTF_8.name()))
						.getAsJsonObject();
				weaveList.add(new WeaveData(item.getName().replace(".json", ""), weave.get("name").getAsString()));
			} catch (IllegalStateException caught) {

			}
		}
	}

	@Override
	protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
		resp.setContentType("application/json");
		resp.setCharacterEncoding(Charsets.UTF_8.name());
		resp.addHeader("Access-Control-Allow-Origin", "*");
		PrintWriter writer = resp.getWriter();
		//if (weaveList.isEmpty())
		//	loadWeaveList();
		//writer.write(new Gson().toJson(weaveList));
		writer.write("[{\"name\":\"European 4-in-1\",\"file\":\"euro-4-in-1\"},{\"name\":\"Japanese 6-in-1\",\"file\":\"jap-6-in-1\"}]");
	}

	private static class WeaveData {
		public String file;
		public String name;

		public WeaveData(String file, String name) {
			this.file = file;
			this.name = name;
		}
	}
}
