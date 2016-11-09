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
public class GetWiresServlet extends HttpServlet {

	@Override
	public void doGet(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
		resp.setContentType("application/json");
		resp.setCharacterEncoding(Charsets.UTF_8.name());
		resp.addHeader("Access-Control-Allow-Origin", "*");
		PrintWriter writer = resp.getWriter();
		writer.write("[");
		writer.write(CharStreams.toString(new InputStreamReader(getServletContext().getResourceAsStream("/data/wire/awg.json"))));
		writer.write(",");
		writer.write(CharStreams.toString(new InputStreamReader(getServletContext().getResourceAsStream("/data/wire/swg.json"))));
		writer.write("]");
	}
}
