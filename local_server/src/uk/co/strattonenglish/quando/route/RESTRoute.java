package uk.co.strattonenglish.quando.route;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.PrintWriter;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.json.JSONObject;

public abstract class RESTRoute extends Route {
	private String contentType = "application/json";
	private int status_code = HttpServletResponse.SC_OK;

	private JSONObject jsonObject;
	
	protected void setJSONObjectOnRequest(HttpServletRequest request) throws IOException {
		StringBuffer buffer = new StringBuffer();
		BufferedReader reader = request.getReader();
		String line;
		while ((line = reader.readLine()) != null) {
		    buffer.append(line);
		}
		jsonObject = new JSONObject(buffer.toString());
	}
	
	protected String getJSONString(String key) {
		return jsonObject.getString(key);
	}
	
	@Override
	public void handle(HttpServletRequest request, HttpServletResponse response)
			throws IOException {
        response.setContentType(contentType);
        response.setStatus(status_code);

        PrintWriter out = response.getWriter();
        out.println(handle_REST(request));
	}
	
	public abstract String handle_REST(HttpServletRequest request) throws IOException;
}