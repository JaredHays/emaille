package com.jaredhays.emaille;

import java.io.IOException;
import java.io.InputStreamReader;
import java.io.PrintWriter;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import com.google.common.base.Charsets;
import com.google.common.io.CharStreams;

@SuppressWarnings("serial")
public class GetWeaveServlet extends HttpServlet {

	@Override
	public void doGet(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
		String name = req.getParameter("name");
		resp.setContentType("application/json");
		resp.setCharacterEncoding(Charsets.UTF_8.name());
		resp.addHeader("Access-Control-Allow-Origin", "*");
		resp.addHeader("Cache-Control", "no-cache");
		PrintWriter writer = resp.getWriter();
		writer.write(CharStreams.toString(new InputStreamReader(getServletContext().getResourceAsStream("/data/weave/" + name + ".json"))));
	}
}
